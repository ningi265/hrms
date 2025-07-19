
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
    const { planId } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.active) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: plan.priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing`,
      customer_email: user.email,
      client_reference_id: userId.toString(),
      metadata: {
        planId: plan._id.toString()
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

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
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      await handleSubscriptionDeleted(subscription);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Helper functions for webhook handling
async function handleCheckoutSession(session) {
  const userId = session.client_reference_id;
  const planId = session.metadata.planId;
  
  const plan = await Plan.findById(planId);
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  
  await User.findByIdAndUpdate(userId, {
    'billing.subscription': {
      plan: plan.name,
      status: subscription.status,
      subscriptionId: subscription.id,
      priceId: subscription.plan.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    },
    'usage.storage.limit': plan.storageLimit,
    'usage.apiCallLimit': plan.apiCallLimit
  });
}

async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  await User.findOneAndUpdate(
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
    }
  );
}

async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  
  await User.findOneAndUpdate(
    { 'billing.subscription.subscriptionId': subscriptionId },
    { 'billing.subscription.status': 'past_due' }
  );
}

async function handleSubscriptionDeleted(subscription) {
  await User.findOneAndUpdate(
    { 'billing.subscription.subscriptionId': subscription.id },
    { 'billing.subscription.status': 'canceled' }
  );
}

// Get current user's subscription
exports.getUserSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('billing usage');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      subscription: user.billing.subscription,
      trial: {
        isActive: user.isOnTrial(),
        endDate: user.billing.trialEndDate,
        remainingDays: user.getRemainingTrialDays()
      },
      usage: user.usage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.billing.subscription.subscriptionId) {
      return res.status(400).json({ message: 'No active subscription' });
    }

    const subscription = await stripe.subscriptions.update(
      user.billing.subscription.subscriptionId,
      { cancel_at_period_end: true }
    );

    await User.findByIdAndUpdate(req.user._id, {
      'billing.subscription.cancelAtPeriodEnd': true,
      'billing.subscription.status': subscription.status
    });

    res.json({ message: 'Subscription will cancel at period end' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reactivate subscription
exports.reactivateSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.billing.subscription.subscriptionId) {
      return res.status(400).json({ message: 'No active subscription' });
    }

    const subscription = await stripe.subscriptions.update(
      user.billing.subscription.subscriptionId,
      { cancel_at_period_end: false }
    );

    await User.findByIdAndUpdate(req.user._id, {
      'billing.subscription.cancelAtPeriodEnd': false,
      'billing.subscription.status': subscription.status
    });

    res.json({ message: 'Subscription reactivated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};