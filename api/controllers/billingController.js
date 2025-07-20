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
    const { planName, priceId, isAnnual } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    console.log('Checkout request:', { planName, priceId, isAnnual, userId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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
          companyName: user.companyName || ''
        }
      });
      
      stripeCustomerId = customer.id;
      console.log('Created Stripe customer:', stripeCustomerId);
      
      // Save Stripe customer ID to user
      await User.findByIdAndUpdate(userId, {
        'billing.stripeCustomerId': stripeCustomerId
      });
    }

    // Determine trial configuration
    const isUserOnTrial = user.isOnTrial();
    const subscriptionData = {
      metadata: {
        planName,
        billingCycle,
        userId: userId.toString()
      }
    };

    // Only add trial_period_days if user is not already on trial
    // If user is on trial, start subscription immediately without additional trial
    if (!isUserOnTrial) {
      subscriptionData.trial_period_days = 14; // Give new users 14 day trial
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
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      client_reference_id: userId.toString(),
      metadata: {
        planName,
        billingCycle,
        userId: userId.toString()
      },
      subscription_data: subscriptionData
    });

    console.log('Stripe checkout session created successfully:', {
      sessionId: session.id,
      userId,
      planName,
      billingCycle,
      stripePriceId
    });

    res.json({ 
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    // Provide specific error messages based on error type
    let errorMessage = 'Failed to create checkout session';
    let errorDetails = {};
    
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        errorMessage = 'Invalid Stripe price ID. Please check your Stripe dashboard configuration.';
        errorDetails = {
          hint: 'Make sure you are using a price ID (starts with "price_"), not a product ID (starts with "prod_")',
          providedId: req.body.priceId,
          stripeError: error.message
        };
      }
    }
    
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
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
      // Set usage limits based on plan
      'usage.storage.limit': getStorageLimitForPlan(planName),
      'usage.apiCallLimit': getApiCallLimitForPlan(planName)
    }, { new: true });

    console.log('Subscription activated for user:', {
      userId,
      planName,
      subscriptionId: subscription.id
    });

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: updatedUser.billing.subscription
    });

  } catch (error) {
    console.error('Error handling checkout success:', error);
    res.status(500).json({ 
      message: 'Failed to process successful checkout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions for plan limits
function getStorageLimitForPlan(planName) {
  const limits = {
    starter: 1000, // 1GB
    professional: 10000, // 10GB
    enterprise: 100000 // 100GB
  };
  return limits[planName] || 1000;
}

function getApiCallLimitForPlan(planName) {
  const limits = {
    starter: 10000,
    professional: 100000,
    enterprise: 1000000
  };
  return limits[planName] || 10000;
}

// Handle Stripe webhooks
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received webhook event:', event.type);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleCheckoutSession(session);
      break;
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      await handlePaymentSucceeded(invoice);
      break;
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      await handlePaymentFailed(failedInvoice);
      break;
    case 'customer.subscription.updated':
      const updatedSubscription = event.data.object;
      await handleSubscriptionUpdated(updatedSubscription);
      break;
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object;
      await handleSubscriptionDeleted(deletedSubscription);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
};

// Helper functions for webhook handling
async function handleCheckoutSession(session) {
  try {
    const userId = session.client_reference_id;
    const planName = session.metadata.planName;
    
    if (!userId || !planName) {
      console.error('Missing required metadata in checkout session');
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    await User.findByIdAndUpdate(userId, {
      'billing.subscription': {
        plan: planName,
        status: subscription.status,
        subscriptionId: subscription.id,
        priceId: subscription.items.data[0].price.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      },
      'billing.stripeCustomerId': session.customer,
      'usage.storage.limit': getStorageLimitForPlan(planName),
      'usage.apiCallLimit': getApiCallLimitForPlan(planName)
    });

    console.log(`Subscription created for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling checkout session:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const updateResult = await User.findOneAndUpdate(
      { 'billing.subscription.subscriptionId': subscriptionId },
      {
        'billing.subscription.status': subscription.status,
        'billing.subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
        'billing.subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
        $push: {
          'billing.invoices': {
            id: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            pdfUrl: invoice.invoice_pdf,
            createdAt: new Date(invoice.created * 1000)
          }
        }
      },
      { new: true }
    );

    console.log(`Payment succeeded for subscription ${subscriptionId}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    
    await User.findOneAndUpdate(
      { 'billing.subscription.subscriptionId': subscriptionId },
      { 'billing.subscription.status': 'past_due' }
    );

    console.log(`Payment failed for subscription ${subscriptionId}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    await User.findOneAndUpdate(
      { 'billing.subscription.subscriptionId': subscription.id },
      {
        'billing.subscription.status': subscription.status,
        'billing.subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
        'billing.subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
        'billing.subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end
      }
    );

    console.log(`Subscription updated: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    await User.findOneAndUpdate(
      { 'billing.subscription.subscriptionId': subscription.id },
      { 
        'billing.subscription.status': 'canceled',
        'billing.subscription.cancelAtPeriodEnd': true
      }
    );

    console.log(`Subscription deleted: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// Get current user's subscription
exports.getUserSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id) // Changed from req.user._id to req.user.id
      .select('billing usage');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate trial status
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
      }
    });
  } catch (error) {
    console.error('Error getting user subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // Changed from req.user._id to req.user.id
    
    if (!user.billing?.subscription?.subscriptionId) {
      return res.status(400).json({ message: 'No active subscription found' });
    }

    const subscription = await stripe.subscriptions.update(
      user.billing.subscription.subscriptionId,
      { cancel_at_period_end: true }
    );

    await User.findByIdAndUpdate(req.user.id, { // Changed from req.user._id to req.user.id
      'billing.subscription.cancelAtPeriodEnd': true,
      'billing.subscription.status': subscription.status
    });

    res.json({ 
      message: 'Subscription will cancel at the end of the current period',
      cancelAt: new Date(subscription.current_period_end * 1000)
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

// Reactivate subscription
exports.reactivateSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // Changed from req.user._id to req.user.id
    
    if (!user.billing?.subscription?.subscriptionId) {
      return res.status(400).json({ message: 'No subscription found' });
    }

    const subscription = await stripe.subscriptions.update(
      user.billing.subscription.subscriptionId,
      { cancel_at_period_end: false }
    );

    await User.findByIdAndUpdate(req.user.id, { // Changed from req.user._id to req.user.id
      'billing.subscription.cancelAtPeriodEnd': false,
      'billing.subscription.status': subscription.status
    });

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get billing history
exports.getBillingHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('billing'); // Changed from req.user._id to req.user.id
    
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

// Update payment method
exports.updatePaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // Changed from req.user._id to req.user.id
    
    if (!user.billing?.stripeCustomerId) {
      return res.status(400).json({ message: 'No Stripe customer found' });
    }

    // Create a setup intent for updating payment method
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