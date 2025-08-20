const User = require('../../models/user');
const Plan = require('../../models/plan');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize trial for new users
exports.startTrial = async (userId) => {
  const trialDays = 14;
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + trialDays);

  return await User.findByIdAndUpdate(userId, {
    'billing.trialStartDate': new Date(),
    'billing.trialEndDate': trialEndDate,
    'billing.subscription.plan': 'trial',
    'billing.subscription.status': 'trialing'
  }, { new: true });
};

// Get subscription plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ active: true });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create checkout session for subscription  
exports.createCheckoutSession = async (req, res) => {
  try {
    const { planName, priceId, isAnnual, isTrial, isCompany } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId).select('isEnterpriseAdmin company isCompany email firstName lastName companyName billing');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine if this is a company account
    const isCompanyAccount = typeof isCompany !== 'undefined' 
      ? isCompany 
      : user.isEnterpriseAdmin || user.isCompany;

    console.log('Checkout request:', { 
      planName, 
      priceId, 
      isAnnual, 
      userId,
      isCompany: isCompanyAccount,
      userIsEnterpriseAdmin: user.isEnterpriseAdmin,
    });

    // Define pricing configuration with environment variables
    const pricingConfig = {
      starter: {
        monthly: { 
          price: 9900, 
          priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID 
        },
        annual: { 
          price: 7900, 
          priceId: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID 
        }
      },
      professional: {
        monthly: { 
          price: 29900, 
          priceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID 
        },
        annual: { 
          price: 23900, 
          priceId: process.env.STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID 
        }
      }
    };

    const planConfig = pricingConfig[planName];
    if (!planConfig) {
      return res.status(400).json({ 
        message: 'Invalid plan selected',
        availablePlans: Object.keys(pricingConfig)
      });
    }

    const billingCycle = isAnnual ? 'annual' : 'monthly';
    const selectedPrice = planConfig[billingCycle];

    // Use provided priceId or fallback to environment variable
    const stripePriceId = priceId || selectedPrice.priceId;

    console.log('Using Stripe Price ID:', stripePriceId);

    if (!stripePriceId) {
      return res.status(500).json({ 
        message: `Stripe price ID not configured for ${planName} ${billingCycle} plan`,
        requiredEnvVar: `STRIPE_${planName.toUpperCase()}_${billingCycle.toUpperCase()}_PRICE_ID`,
        planName,
        billingCycle
      });
    }

    // Validate that the price ID looks correct (starts with 'price_')
    if (!stripePriceId.startsWith('price_')) {
      return res.status(400).json({
        message: 'Invalid price ID format. Price IDs should start with "price_"',
        providedId: stripePriceId,
        hint: 'Make sure you are using a price ID, not a product ID'
      });
    }

    // Create Stripe customer if not exists
    let stripeCustomerId = user.billing?.stripeCustomerId;
    if (!stripeCustomerId) {
      console.log('Creating new Stripe customer for user:', userId);
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId.toString(),
          companyName: user.companyName || '',
          isCompany: isCompanyAccount ? 'true' : 'false'
        }
      });
      
      stripeCustomerId = customer.id;
      console.log('Created Stripe customer:', stripeCustomerId);
      
      // Save Stripe customer ID to user
      await User.findByIdAndUpdate(userId, {
        'billing.stripeCustomerId': stripeCustomerId,
        'isCompany': isCompanyAccount
      });
    }

    // Determine trial configuration
    const isUserOnTrial = user.isOnTrial();
    const subscriptionData = {
      metadata: {
        planName,
        billingCycle,
        userId: userId.toString(),
        isCompany: isCompanyAccount ? 'true' : 'false'
      }
    };

    // Only add trial_period_days if user is not already on trial
    if (!isUserOnTrial) {
      subscriptionData.trial_period_days = 14;
    }

    // Create Stripe checkout session
    console.log('Creating checkout session with price ID:', stripePriceId);
    console.log('User on trial:', isUserOnTrial);
    
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: stripePriceId,
        quantity: 1,
      }],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?payment=canceled`,
      client_reference_id: userId.toString(),
      metadata: {
        planName,
        billingCycle,
        userId: userId.toString(),
        isCompany: isCompanyAccount ? 'true' : 'false'
      },
      subscription_data: subscriptionData
    });

    console.log('Stripe checkout session created successfully:', {
      sessionId: session.id,
      userId,
      planName,
      billingCycle,
      stripePriceId,
      isCompany: isCompanyAccount
    });

    res.json({ 
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    res.status(500).json({ 
      message: 'Failed to create checkout session'
    });
  }
};

// Handle successful checkout
exports.handleCheckoutSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });

    if (!session.subscription) {
      return res.status(400).json({ message: 'No subscription found in session' });
    }

    const userId = session.client_reference_id;
    const subscription = session.subscription;
    const planName = session.metadata.planName;
    const billingCycle = session.metadata.billingCycle;

    // Update user subscription
    const updatedUser = await User.findByIdAndUpdate(userId, {
      'billing.subscription': {
        plan: planName,
        status: subscription.status,
        subscriptionId: subscription.id,
        priceId: subscription.items.data[0].price.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      },
      'billing.stripeCustomerId': session.customer.id,
      'usage.storage.limit': getStorageLimitForPlan(planName),
      'usage.apiCallLimit': getApiCallLimitForPlan(planName)
    }, { new: true }).select('company isCompany billing');

    console.log('Subscription activated for user:', {
      userId,
      planName,
      subscriptionId: subscription.id,
      isCompany: updatedUser.isCompany
    });

    // If this is a company account, update all employees
    if (updatedUser.isCompany) {
      console.log('🏢 Detected company account - updating employees');
      await updateCompanyAccounts(updatedUser.company, { // ✅ FIXED
        status: subscription.status,
        plan: planName,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });
    }

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: updatedUser.billing.subscription
    });

  } catch (error) {
    console.error('Error handling checkout success:', error);
    res.status(500).json({ 
      message: 'Failed to process successful checkout'
    });
  }
};


// Webhook handler
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  console.log('📥 Webhook received at:', new Date().toISOString());

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Webhook signature verified - Event type:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`🔄 Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    res.json({ received: true, eventType: event.type });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      eventType: event.type
    });
  }
};

async function handleCheckoutCompleted(session) {
  console.log('🎉 Processing checkout completion for session:', session.id);
  
  try {
    const userId = session.client_reference_id;
    const planName = session.metadata?.planName;
    const billingCycle = session.metadata?.billingCycle;
    const isCompanyAccount = session.metadata?.isCompany === 'true';
    
    if (!userId || !planName) {
      console.error('❌ Missing required metadata in checkout session');
      return;
    }

    const user = await User.findById(userId).select('isCompany employees email firstName lastName companyName company');
    if (!user) {
      console.error('❌ User not found with ID:', userId);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ['items.data.price.product']
    });
    
    const updateData = {
      'billing.subscription.plan': planName,
      'billing.subscription.status': subscription.status,
      'billing.subscription.subscriptionId': subscription.id,
      'billing.subscription.priceId': subscription.items.data[0].price.id,
      'billing.subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end || false,
      'billing.stripeCustomerId': session.customer,
      'usage.storage.limit': getStorageLimitForPlan(planName),
      'usage.apiCallLimit': getApiCallLimitForPlan(planName),
      'isCompany': isCompanyAccount
    };

    const updatedAccount = await User.findByIdAndUpdate(userId, updateData, { 
      new: true,
      select: 'isCompany companyName employees company'
    });

    console.log('✅ Account subscription activated:', {
      userId,
      plan: planName,
      subscriptionId: subscription.id,
      status: subscription.status,
      isCompany: isCompanyAccount,
      companyName: updatedAccount.companyName
    });

    if (isCompanyAccount) {
      console.log('🏢 COMPANY ACCOUNT DETECTED - Starting employee updates');
      const updateResult = await updateCompanyAccounts(
        updatedAccount.company, // ✅ FIXED
        {
          status: subscription.status,
          plan: planName,
          isTrial: subscription.status === 'trialing',
          storageLimit: getStorageLimitForPlan(planName),
          apiCallLimit: getApiCallLimitForPlan(planName),
          isCompany: true
        }
      );
      console.log(`🔄 COMPANY UPDATE RESULT: ${updateResult.totalUpdated} employees updated`);
    }
  }
  catch (error) {
    console.error('❌ Error processing checkout completion:', error);         
    throw error;
  }
}

// Enhanced company account updater
async function updateCompanyAccounts(companyId, updateData) {
  console.log('🚀 Starting company account update for companyId:', companyId);

  try {
    // Prepare update payload
    const updatePayload = {
      'billing.subscription.status': updateData.status,
      'billing.subscription.plan': updateData.plan,
      'billing.subscription.isTrial': updateData.isTrial || false,
      'billing.lastSyncedAt': new Date(),
      'usage.storage.limit': updateData.storageLimit || getStorageLimitForPlan(updateData.plan),
      'usage.apiCallLimit': updateData.apiCallLimit || getApiCallLimitForPlan(updateData.plan)
    };

    if (updateData.currentPeriodStart) {
      updatePayload['billing.subscription.currentPeriodStart'] = updateData.currentPeriodStart;
    }
    if (updateData.currentPeriodEnd) {
      updatePayload['billing.subscription.currentPeriodEnd'] = updateData.currentPeriodEnd;
    }
    if (updateData.trialEnd) {
      updatePayload['billing.subscription.trialEnd'] = updateData.trialEnd;
    }

    // Find employees by company field
    const employees = await User.find({
      company: companyId,
      isEnterpriseAdmin: false
    }).select('_id email firstName lastName');

    console.log(`👥 FOUND ${employees.length} EMPLOYEES TO UPDATE for companyId: ${companyId}`);

    if (employees.length === 0) {
      console.log('ℹ️ No employees found for this company');
      return { success: true, totalUpdated: 0 };
    }

    // Batch update employees
    const BATCH_SIZE = 100;
    let totalUpdated = 0;
    let batchNumber = 1;

    while (totalUpdated < employees.length) {
      const batch = employees.slice(totalUpdated, totalUpdated + BATCH_SIZE);
      const result = await User.updateMany(
        { _id: { $in: batch.map(e => e._id) } },
        { $set: updatePayload }
      );

      totalUpdated += result.modifiedCount;
      console.log(`✅ BATCH #${batchNumber} COMPLETE - Updated ${result.modifiedCount} employees`);
      batchNumber++;
    }

    console.log(`🎉 COMPANY UPDATE COMPLETE - Total employees updated: ${totalUpdated}`);
    return { success: true, totalUpdated };
  } catch (error) {
    console.error(`❌ COMPANY UPDATE FAILED - Company ID: ${companyId}`, error);
    return { success: false, error: error.message };
  }
}


// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const account = await User.findOne({ 
      'billing.subscription.subscriptionId': subscriptionId 
    }).select('isCompany company');

    if (!account) {
      console.error(`❌ No account found with subscription ${subscriptionId}`);
      return;
    }

    const invoiceData = {
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      createdAt: new Date(invoice.created * 1000)
    };

    const updateData = {
      'billing.subscription.status': subscription.status,
      $push: { 'billing.invoices': invoiceData }
    };

    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    
    updateData['billing.subscription.currentPeriodStart'] = currentPeriodStart;
    updateData['billing.subscription.currentPeriodEnd'] = currentPeriodEnd;

    await User.findByIdAndUpdate(account._id, updateData);

    if (account.isCompany) {
      console.log('🏢 COMPANY ACCOUNT DETECTED - Starting employee updates');
      const companyUpdateData = {
        status: subscription.status,
        currentPeriodStart,
        currentPeriodEnd
      };
      await updateCompanyAccounts(account.company, companyUpdateData); // ✅ FIXED
    }
  } catch (error) {
    console.error('❌ PAYMENT PROCESSING FAILED:', error);
    throw error;
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const account = await User.findOne({ 
      'billing.subscription.subscriptionId': subscriptionId 
    }).select('isCompany company');

    if (!account) {
      console.error(`❌ No account found with subscription ${subscriptionId}`);
      return;
    }

    await User.findByIdAndUpdate(account._id, {
      'billing.subscription.status': 'past_due',
      $push: {
        'billing.paymentFailures': {
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt ? 
            new Date(invoice.next_payment_attempt * 1000) : null,
          createdAt: new Date(invoice.created * 1000)
        }
      }
    });

    if (account.isCompany) {
      console.log('🏢 Detected company account - updating all employees');
      await updateCompanyAccounts(account.company, { status: 'past_due' }); // ✅ FIXED
    }
  } catch (error) {
    console.error('❌ Error handling payment failed:', error);
    throw error;
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  try {
    const account = await User.findOne({ 
      'billing.subscription.subscriptionId': subscription.id 
    }).select('isCompany company');

    if (!account) {
      console.error(`❌ No account found with subscription ${subscription.id}`);
      return;
    }

    const updateData = {
      'billing.subscription.status': subscription.status,
      'billing.subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'billing.subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      'billing.subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
      'billing.subscription.plan': getPlanFromSubscription(subscription)
    };

    await User.findByIdAndUpdate(account._id, updateData);

    if (account.isCompany) {
      console.log('🏢 Detected company account - updating all employees');
      await updateCompanyAccounts(account.company, { // ✅ FIXED
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: getPlanFromSubscription(subscription)
      });
    }
  } catch (error) {
    console.error('❌ Error handling subscription updated:', error);
    throw error;
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  try {
    const account = await User.findOne({ 
      'billing.subscription.subscriptionId': subscription.id 
    }).select('isCompany company');

    if (!account) {
      console.error(`❌ No account found with subscription ${subscription.id}`);
      return;
    }

    const updateData = {
      'billing.subscription.status': 'canceled',
      'billing.subscription.cancelAtPeriodEnd': true,
      'billing.subscription.endedAt': new Date()
    };

    await User.findByIdAndUpdate(account._id, updateData);

    if (account.isCompany) {
      console.log('🏢 Detected company account - updating all employees');
      await updateCompanyAccounts(account.company, { // ✅ FIXED
        status: 'canceled',
        cancelAtPeriodEnd: true
      });
    }
  } catch (error) {
    console.error('❌ Error handling subscription deleted:', error);
    throw error;
  }
}

function getPlanFromSubscription(subscription) {
  try {
    return subscription.items.data[0].price.product.name;
  } catch {
    return null;
  }
}

// Storage limits
function getStorageLimitForPlan(plan) {
  const planLimits = {
    enterprise: 10240,
    professional: 5120,
    starter: 100
  };
  return planLimits[plan?.toLowerCase()] || 100;
}

function getApiCallLimitForPlan(plan) {
  const planLimits = {
    enterprise: 1000000,
    professional: 100000,
    starter: 10000
  };
  return planLimits[plan?.toLowerCase()] || 10000;
}

exports.getUserSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('billing usage isCompany');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const trialActive = user.isOnTrial();
    const trialDaysRemaining = user.getRemainingTrialDays();
    
    res.json({
      subscription: user.billing?.subscription || {
        plan: 'trial',
        status: 'trialing'
      },
      trial: {
        isActive: trialActive,
        endDate: user.billing?.trialEndDate,
        remainingDays: trialDaysRemaining
      },
      usage: user.usage || {
        apiCalls: { count: 0, lastReset: new Date() },
        storage: { used: 0, limit: 100 }
      },
      isCompany: user.isCompany || false
    });
  } catch (error) {
    console.error('Error getting user subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('billing isCompany company');
    
    if (!user.billing?.subscription?.subscriptionId) {
      return res.status(400).json({ message: 'No active subscription found' });
    }

    const subscription = await stripe.subscriptions.update(
      user.billing.subscription.subscriptionId,
      { cancel_at_period_end: true }
    );

    await User.findByIdAndUpdate(req.user._id, {
      'billing.subscription.cancelAtPeriodEnd': true,
      'billing.subscription.status': subscription.status
    });

    if (user.isCompany) {
      console.log('🏢 Detected company account - updating employees');
      await updateCompanyAccounts(user.company, { // ✅ FIXED
        status: subscription.status,
        cancelAtPeriodEnd: true
      });
    }

    res.json({ 
      message: 'Subscription will cancel at the end of the current period',
      cancelAt: new Date(subscription.current_period_end * 1000)
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.reactivateSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('billing isCompany company');
    
    if (!user.billing?.subscription?.subscriptionId) {
      return res.status(400).json({ message: 'No subscription found' });
    }

    const subscription = await stripe.subscriptions.update(
      user.billing.subscription.subscriptionId,
      { cancel_at_period_end: false }
    );

    await User.findByIdAndUpdate(req.user._id, {
      'billing.subscription.cancelAtPeriodEnd': false,
      'billing.subscription.status': subscription.status
    });

    if (user.isCompany) {
      console.log('🏢 Detected company account - updating employees');
      await updateCompanyAccounts(user.company, { // ✅ FIXED
        status: subscription.status,
        cancelAtPeriodEnd: false
      });
    }

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getBillingHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('billing');
    
    if (!user || !user.billing?.invoices) {
      return res.json({ invoices: [] });
    }

    res.json({ 
      invoices: user.billing.invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  } catch (error) {
    console.error('Error getting billing history:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updatePaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('billing');
    
    if (!user.billing?.stripeCustomerId) {
      return res.status(400).json({ message: 'No Stripe customer found' });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: user.billing.stripeCustomerId,
      usage: 'off_session'
    });

    res.json({ 
      clientSecret: setupIntent.client_secret,
      customerId: user.billing.stripeCustomerId
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.handleCompanySubscriptionUpdate = async (companyId) => {
  try {
    console.log(`[Webhook] Processing subscription update for company ${companyId}`);
    
    const company = await User.findById(companyId).select('billing companyName');
    if (!company) {
      console.error(`[Webhook] Company not found: ${companyId}`);
      return;
    }

    const updatePayload = {
      'billing.trialEndDate': company.billing?.trialEndDate,
      'billing.subscription': company.billing?.subscription,
      'usage.storage.limit': getStorageLimitForPlan(company.billing?.subscription?.plan),
      'billing.lastSyncedAt': new Date(),
      'billing.syncMethod': 'webhook'
    };

    const result = await User.updateMany(
      { company: companyId },
      { $set: updatePayload }
    );

    console.log(`[Webhook] Updated ${result.modifiedCount} employees for ${company.companyName}`);
  } catch (error) {
    console.error(`[Webhook] Failed to update employees for company ${companyId}:`, error);
  }
};
