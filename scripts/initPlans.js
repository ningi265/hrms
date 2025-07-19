// scripts/initPlans.js
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function initPlans() {
  await mongoose.connect(process.env.MONGO_URI);

  // Create products and prices in Stripe
  const plans = [
    {
      name: 'starter',
      price: 10000, // $100 in cents
      features: {
        apiAccess: true,
        analytics: true,
        support: 'email'
      },
      apiCallLimit: 10000,
      storageLimit: 1024 // 1GB
    },
    {
      name: 'professional',
      price: 17900, // $179 in cents
      features: {
        apiAccess: true,
        analytics: true,
        support: 'priority',
        advancedFeatures: true
      },
      apiCallLimit: 50000,
      storageLimit: 5120 // 5GB
    },
    {
      name: 'enterprise',
      price: 29900, // $299 in cents
      features: {
        apiAccess: true,
        analytics: true,
        support: '24/7',
        advancedFeatures: true,
        customSolutions: true
      },
      apiCallLimit: 200000,
      storageLimit: 10240 // 10GB
    }
  ];

  for (const plan of plans) {
    // Check if product already exists
    let existingPlan = await Plan.findOne({ name: plan.name });
    
    if (!existingPlan) {
      // Create Stripe product
      const product = await stripe.products.create({
        name: `${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan`,
        description: `${plan.name} plan features`
      });

      // Create Stripe price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: 'usd',
        recurring: {
          interval: 'month'
        }
      });

      // Save to database
      existingPlan = new Plan({
        name: plan.name,
        priceId: price.id,
        price: plan.price / 100,
        currency: 'usd',
        interval: 'month',
        features: plan.features,
        apiCallLimit: plan.apiCallLimit,
        storageLimit: plan.storageLimit
      });

      await existingPlan.save();
      console.log(`Created ${plan.name} plan`);
    } else {
      console.log(`${plan.name} plan already exists`);
    }
  }

  mongoose.disconnect();
}

initPlans().catch(console.error);