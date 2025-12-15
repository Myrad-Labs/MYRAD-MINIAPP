// Enterprise Data Pipeline for MYRAD
// Transforms raw Reclaim data into sellable, anonymized datasets
// Follows k-anonymity principles and generates enriched insights

import 'dotenv/config';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
dayjs.extend(customParseFormat);

// Import production services
import { generateDeterministicCohortId } from './cohortService.js';
import { validateSellableData, getValidationStatus } from './schemaValidator.js';

// Data quality constants
const DATA_WINDOW_DAYS = 90;
const MIN_K_ANONYMITY = 10; // Minimum cohort size for k-anonymity

// ================================
// CONFIGURATION
// ================================

const DATASET_CONFIG = {
    zomato: {
        dataset_id: 'myrad_zomato_v1',
        platform: 'zomato_india',
        version: '1.0.0'
    }
};

// Category mappings for food items
const FOOD_CATEGORIES = {
    // Cuisine categories
    'indian': { l1: 'Regional Cuisine', l2: 'Indian' },
    'north indian': { l1: 'Regional Cuisine', l2: 'North Indian' },
    'south indian': { l1: 'Regional Cuisine', l2: 'South Indian' },
    'chinese': { l1: 'Asian Cuisine', l2: 'Chinese' },
    'italian': { l1: 'Western Cuisine', l2: 'Italian' },
    'pizza': { l1: 'Fast Food', l2: 'Pizza' },
    'burger': { l1: 'Fast Food', l2: 'Burgers' },
    'biryani': { l1: 'Regional Cuisine', l2: 'Biryani' },
    'thali': { l1: 'Regional Cuisine', l2: 'Indian Thali' },
    'desserts': { l1: 'Desserts & Sweets', l2: 'Desserts' },
    'beverages': { l1: 'Beverages', l2: 'Drinks' },
    'cafe': { l1: 'Cafe', l2: 'Coffee & Snacks' },
    'healthy': { l1: 'Health Food', l2: 'Salads & Bowls' },
    'momo': { l1: 'Asian Cuisine', l2: 'Momos & Dumplings' },
    'shawarma': { l1: 'Fast Food', l2: 'Shawarma & Wraps' },
    'sandwich': { l1: 'Fast Food', l2: 'Sandwiches' },
    'fried_chicken': { l1: 'Fast Food', l2: 'Fried Chicken' },
    'kebab': { l1: 'Regional Cuisine', l2: 'Kebabs & Grills' },
    'default': { l1: 'Food & Dining', l2: 'General' }
};

// Cuisine inference from item names
const CUISINE_PATTERNS = [
    // Biryani & Rice dishes
    { pattern: /biryani|pulao|fried rice/i, cuisine: 'Biryani & Rice' },
    // Momos & Chinese
    { pattern: /momo|noodle|manchurian|chow|shanghai|schezwan|szechuan|darsaan/i, cuisine: 'Chinese' },
    // South Indian
    { pattern: /dosa|idli|idly|vada|uttapam|upma|sambar/i, cuisine: 'South Indian' },
    // North Indian
    { pattern: /naan|roti|paratha|paneer|butter chicken|dal makhani|tandoori|tikka|chaap|kebab|korma|masala/i, cuisine: 'North Indian' },
    // Pizza & Italian
    { pattern: /pizza|pasta|lasagna|garlic bread/i, cuisine: 'Pizza & Italian' },
    // Burgers
    { pattern: /burger|fries|nuggets/i, cuisine: 'Burgers' },
    // Fried Chicken
    { pattern: /fried chicken|chicken leg|chicken breast|popcorn chicken|chicken bucket/i, cuisine: 'Fried Chicken' },
    // Shawarma & Wraps
    { pattern: /shawarma|wrap|roll|kathi/i, cuisine: 'Shawarma & Wraps' },
    // Sandwiches
    { pattern: /sandwich|club|sub/i, cuisine: 'Sandwiches' },
    // Desserts
    { pattern: /ice cream|brownie|cake|gulab jamun|rasgulla/i, cuisine: 'Desserts' },
    // Beverages
    { pattern: /coffee|tea|shake|smoothie|juice|lassi|mojito|thumbs up|coca cola|pepsi/i, cuisine: 'Beverages' }
];

// Brand inference patterns - expanded for Indian market
const BRAND_PATTERNS = [
    // International QSR
    { pattern: /domino/i, brand: 'Dominos' },
    { pattern: /pizza\s*hut/i, brand: 'Pizza Hut' },
    { pattern: /mcdonald|mcD/i, brand: 'McDonalds' },
    { pattern: /kfc/i, brand: 'KFC' },
    { pattern: /burger\s*king/i, brand: 'Burger King' },
    { pattern: /subway/i, brand: 'Subway' },
    { pattern: /starbucks/i, brand: 'Starbucks' },
    { pattern: /taco\s*bell/i, brand: 'Taco Bell' },
    { pattern: /dunkin/i, brand: 'Dunkin' },

    // Indian Cafe & QSR
    { pattern: /cafe\s*coffee\s*day|ccd/i, brand: 'Cafe Coffee Day' },
    { pattern: /chaayos/i, brand: 'Chaayos' },
    { pattern: /chai\s*point/i, brand: 'Chai Point' },

    // Indian Food Chains
    { pattern: /haldiram/i, brand: 'Haldirams' },
    { pattern: /barbeque\s*nation|bbq\s*nation/i, brand: 'Barbeque Nation' },
    { pattern: /behrouz/i, brand: 'Behrouz Biryani' },
    { pattern: /biryani\s*blues/i, brand: 'Biryani Blues' },
    { pattern: /paradise/i, brand: 'Paradise Biryani' },
    { pattern: /aminia/i, brand: 'Aminia' },
    { pattern: /arsalan|haji\s*arsalan/i, brand: 'Haji Arsalan' },

    // Cloud Kitchens & Delivery Brands
    { pattern: /faasos/i, brand: 'Faasos' },
    { pattern: /box8/i, brand: 'Box8' },
    { pattern: /ovenstory/i, brand: 'Ovenstory' },
    { pattern: /licious/i, brand: 'Licious' },
    { pattern: /wow\s*momo/i, brand: 'Wow Momo' },
    { pattern: /mojo\s*pizza/i, brand: 'Mojo Pizza' },
    { pattern: /oven\s*story/i, brand: 'Ovenstory' },
    { pattern: /theobroma/i, brand: 'Theobroma' },
    { pattern: /naturals/i, brand: 'Naturals Ice Cream' },
    { pattern: /nic\s*ice/i, brand: 'NIC Ice Creams' },
    { pattern: /baskin/i, brand: 'Baskin Robbins' },
    { pattern: /kwality\s*wall/i, brand: 'Kwality Walls' },

    // Regional Chains - Kolkata
    { pattern: /chowman/i, brand: 'Chowman' },
    { pattern: /peter\s*cat/i, brand: 'Peter Cat' },
    { pattern: /6\s*ballygunge\s*place/i, brand: '6 Ballygunge Place' },
    { pattern: /monginis/i, brand: 'Monginis' },
    { pattern: /flurys/i, brand: 'Flurys' },

    // Specific from user data
    { pattern: /snacks\s*center/i, brand: 'Snacks Center' },
    { pattern: /sitala\s*tiffin/i, brand: 'Sitala Tiffin' },
    { pattern: /punjab\s*restaurant/i, brand: 'Punjab Restaurant' },
    { pattern: /chicken\s*hut/i, brand: 'The Chicken Hut' },
    { pattern: /snap\s*sandwich/i, brand: 'Snap Sandwich' },
    { pattern: /rosemary/i, brand: 'Rosemary' },
    { pattern: /aapna\s*rasoi/i, brand: 'Aapna Rasoi' },
    { pattern: /urban\s*tadka/i, brand: 'Urban Tadka' },
    { pattern: /new\s*biryani/i, brand: 'New Biryani' },
    { pattern: /shanghai/i, brand: 'Shanghai' },
    { pattern: /chow.s\s*nano/i, brand: 'Chows Nano Duzi' },
    { pattern: /rr\s*cafe/i, brand: 'RR Cafe' },
    { pattern: /heritage\s*cafe/i, brand: 'Heritage Cafe' },
    { pattern: /flavour\s*cafe/i, brand: 'The Flavour Cafe' }
];

// Infer cuisine from item name string
const inferCuisineFromItems = (itemsStr) => {
    if (!itemsStr || typeof itemsStr !== 'string') return 'Unknown';

    for (const { pattern, cuisine } of CUISINE_PATTERNS) {
        if (pattern.test(itemsStr)) {
            return cuisine;
        }
    }
    return 'Unknown';
};

// ================================
// ENTERPRISE ANALYTICS FUNCTIONS
// ================================

// Parse timestamp string robustly using dayjs
// Handles "December 01, 2025 at 03:15 PM" and other variants
const parseOrderTimestamp = (timestampStr) => {
    if (!timestampStr) return null;
    try {
        // Clean up the string
        const cleaned = timestampStr.replace(' at ', ' ').trim();

        // Try multiple common formats
        const formats = [
            'MMMM DD, YYYY hh:mm A',  // "December 01, 2025 03:15 PM"
            'MMMM D, YYYY hh:mm A',   // "December 1, 2025 03:15 PM"
            'YYYY-MM-DDTHH:mm:ssZ',   // ISO format
            'YYYY-MM-DD HH:mm:ss',    // Standard datetime
            'DD-MM-YYYY HH:mm',       // European format
            'MM-DD-YYYY HH:mm',       // US format
            'DD/MM/YYYY HH:mm',       // Slash format
        ];

        const dt = dayjs(cleaned, formats, true);
        return dt.isValid() ? dt.toDate() : null;
    } catch (e) {
        return null;
    }
};

// Bulletproof price parsing - handles all formats
const parsePrice = (p) => {
    if (!p) return 0;
    if (typeof p === 'number') return p;
    // Remove currency symbols, commas, whitespace - keep only digits, dot, minus
    const cleaned = ('' + p).replace(/[^\d.\-]/g, '');
    return parseFloat(cleaned) || 0;
};

// Extract dish names from items string
const extractDishes = (itemsStr) => {
    if (!itemsStr || typeof itemsStr !== 'string') return [];
    // Split by comma and extract dish names (remove quantity prefix like "1 x ")
    return itemsStr.split(',').map(item => {
        const trimmed = item.trim();
        const match = trimmed.match(/^\d+\s*x\s*(.+)$/i);
        return match ? match[1].trim() : trimmed;
    }).filter(d => d.length > 0);
};

// Infer city tier from restaurant names and patterns
const inferCityTier = (restaurants, geo) => {
    const kolkataPatterns = /aminia|arsalan|chowman|peter cat|flurys|6 ballygunge|monginis/i;
    const mumbaiPatterns = /theobroma|cafe mondegar|leopold|britannia/i;
    const delhiPatterns = /haldirams|barbeque nation|moti mahal|paranthe wali/i;
    const bengaluruPatterns = /mtr|vidyarthi bhavan|nagarjuna|empire/i;

    const allRestaurants = restaurants.join(' ');

    if (kolkataPatterns.test(allRestaurants)) return { tier: 'tier_1_metro', city_cluster: 'kolkata' };
    if (mumbaiPatterns.test(allRestaurants)) return { tier: 'tier_1_metro', city_cluster: 'mumbai' };
    if (delhiPatterns.test(allRestaurants)) return { tier: 'tier_1_metro', city_cluster: 'delhi_ncr' };
    if (bengaluruPatterns.test(allRestaurants)) return { tier: 'tier_1_metro', city_cluster: 'bengaluru' };

    // Default inference based on brand presence
    const hasMajorChains = /kfc|mcdonald|pizza hut|dominos|starbucks/i.test(allRestaurants);
    if (hasMajorChains) return { tier: 'tier_1_2_city', city_cluster: 'metro_adjacent' };

    return { tier: 'tier_2_3_city', city_cluster: 'regional' };
};

// Calculate temporal behavior analytics
const calculateTemporalBehavior = (orders) => {
    const dayOfWeekCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const hourBuckets = { morning: 0, afternoon: 0, evening: 0, dinner: 0, late_night: 0 };
    const monthDistribution = {};
    const weekdayVsWeekend = { weekday: 0, weekend: 0 };

    let monthStartSpend = 0, monthEndSpend = 0;
    let monthStartOrders = 0, monthEndOrders = 0;

    orders.forEach(order => {
        const date = parseOrderTimestamp(order.timestamp);
        if (!date) return;

        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        const dayOfMonth = date.getDate();
        const month = date.getMonth();
        const price = parseFloat(order.price?.replace(/[₹,]/g, '')) || 0;

        // Day of week
        dayOfWeekCount[dayOfWeek]++;

        // Weekend vs weekday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekdayVsWeekend.weekend++;
        } else {
            weekdayVsWeekend.weekday++;
        }

        // Time of day buckets
        if (hour >= 6 && hour < 12) hourBuckets.morning++;
        else if (hour >= 12 && hour < 16) hourBuckets.afternoon++;
        else if (hour >= 16 && hour < 19) hourBuckets.evening++;
        else if (hour >= 19 && hour < 22) hourBuckets.dinner++;
        else hourBuckets.late_night++;

        // Month distribution
        const monthKey = `${date.getFullYear()}-${String(month + 1).padStart(2, '0')}`;
        monthDistribution[monthKey] = (monthDistribution[monthKey] || 0) + 1;

        // Month start (1-10) vs month end (20-31)
        if (dayOfMonth <= 10) {
            monthStartSpend += price;
            monthStartOrders++;
        } else if (dayOfMonth >= 20) {
            monthEndSpend += price;
            monthEndOrders++;
        }
    });

    // Calculate weekly consistency
    const orderCounts = Object.values(dayOfWeekCount);
    const avgOrdersPerDay = orderCounts.reduce((a, b) => a + b, 0) / 7;
    const variance = orderCounts.reduce((sum, count) => sum + Math.pow(count - avgOrdersPerDay, 2), 0) / 7;
    const weeklyConsistencyScore = Math.max(0, 100 - Math.sqrt(variance) * 10);

    // Find peak day and time
    const peakDay = Object.entries(dayOfWeekCount).sort((a, b) => b[1] - a[1])[0];
    const peakTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
        day_of_week_distribution: {
            monday: dayOfWeekCount[1],
            tuesday: dayOfWeekCount[2],
            wednesday: dayOfWeekCount[3],
            thursday: dayOfWeekCount[4],
            friday: dayOfWeekCount[5],
            saturday: dayOfWeekCount[6],
            sunday: dayOfWeekCount[0]
        },
        time_of_day_curve: hourBuckets,
        peak_ordering_day: dayNames[parseInt(peakDay[0])],
        peak_ordering_time: peakTime[0],
        weekday_vs_weekend_ratio: weekdayVsWeekend.weekday > 0 ?
            (weekdayVsWeekend.weekend / weekdayVsWeekend.weekday).toFixed(2) : 0,
        month_spend_pattern: {
            month_start_avg_spend: monthStartOrders > 0 ? Math.round(monthStartSpend / monthStartOrders) : 0,
            month_end_avg_spend: monthEndOrders > 0 ? Math.round(monthEndSpend / monthEndOrders) : 0,
            salary_cycle_sensitivity: monthStartOrders > monthEndOrders * 1.3 ? 'high' :
                monthStartOrders > monthEndOrders ? 'moderate' : 'low'
        },
        weekly_consistency_score: Math.round(weeklyConsistencyScore),
        late_night_eater: hourBuckets.late_night > orders.length * 0.1,
        monthly_ordering_pattern: monthDistribution
    };
};

// Calculate price sensitivity analytics  
const calculatePriceSensitivity = (orders) => {
    const pricePoints = [];
    const priceBuckets = { budget: 0, mid_range: 0, premium: 0, luxury: 0 };
    let discountOrders = 0;

    orders.forEach(order => {
        const price = parsePrice(order.price);
        if (price > 0) pricePoints.push(price);

        // Price bucket classification
        if (price < 150) priceBuckets.budget++;
        else if (price < 300) priceBuckets.mid_range++;
        else if (price < 500) priceBuckets.premium++;
        else priceBuckets.luxury++;

        // Detect discount usage (items with "offer", "combo", "deal" etc.)
        const itemsStr = (order.items || '').toLowerCase();
        if (/offer|combo|deal|discount|value|saver|special/i.test(itemsStr)) {
            discountOrders++;
        }
    });

    // Calculate price elasticity indicators
    const avgPrice = pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length || 0;
    const priceStdDev = Math.sqrt(pricePoints.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / pricePoints.length) || 0;
    const priceVariationCoeff = avgPrice > 0 ? (priceStdDev / avgPrice) : 0;

    // Normalized price sensitivity index (0-100 scale)
    // Based on coefficient of variation: 0 = consistent spender, 100 = highly variable
    // CV < 0.2 = very low sensitivity (0-20), CV > 0.6 = very high (60-100)
    const normalizedPSI = Math.round(Math.min(100, Math.max(0, priceVariationCoeff * 150)));

    // Calculate dominant price bucket
    const totalOrders = Object.values(priceBuckets).reduce((a, b) => a + b, 0);
    const dominantBucket = Object.entries(priceBuckets).sort((a, b) => b[1] - a[1])[0];

    return {
        price_bucket_distribution: {
            budget_pct: Math.round((priceBuckets.budget / totalOrders) * 100),
            mid_range_pct: Math.round((priceBuckets.mid_range / totalOrders) * 100),
            premium_pct: Math.round((priceBuckets.premium / totalOrders) * 100),
            luxury_pct: Math.round((priceBuckets.luxury / totalOrders) * 100)
        },
        dominant_price_segment: dominantBucket[0],
        discount_usage_rate: Math.round((discountOrders / orders.length) * 100),
        offer_dependent: discountOrders > orders.length * 0.3,
        price_sensitivity_index: normalizedPSI,
        price_sensitivity_index_scale: '0-100 (0=consistent spender, 100=highly variable)',
        elasticity_score: priceVariationCoeff > 0.5 ? 'price_elastic' :
            priceVariationCoeff > 0.3 ? 'moderately_elastic' : 'price_inelastic',
        premium_vs_budget_ratio: priceBuckets.budget > 0 ?
            ((priceBuckets.premium + priceBuckets.luxury) / priceBuckets.budget).toFixed(2) : 'premium_focused'
    };
};

// Calculate repeat dish patterns
const calculateRepeatPatterns = (orders) => {
    const dishCount = {};
    const cuisineSequence = [];
    const restaurantCount = {};

    orders.forEach(order => {
        const dishes = extractDishes(order.items || '');
        dishes.forEach(dish => {
            const normalized = dish.toLowerCase().replace(/\[.*?\]/g, '').trim();
            dishCount[normalized] = (dishCount[normalized] || 0) + 1;
        });

        const cuisine = inferCuisineFromItems(order.items || '');
        cuisineSequence.push(cuisine);

        const restaurant = order.restaurant || '';
        if (restaurant) {
            restaurantCount[restaurant] = (restaurantCount[restaurant] || 0) + 1;
        }
    });

    // Calculate repeat rates
    const totalDishes = Object.values(dishCount).reduce((a, b) => a + b, 0);
    const uniqueDishes = Object.keys(dishCount).length;
    const repeatRate = uniqueDishes > 0 ? ((totalDishes - uniqueDishes) / totalDishes * 100) : 0;

    // Top repeat dishes
    const topDishes = Object.entries(dishCount)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([dish, count]) => ({ dish_name: dish, order_count: count, repeat_rate: Math.round((count / orders.length) * 100) }));

    // Cuisine fatigue detection
    const cuisineCounts = {};
    cuisineSequence.forEach(c => { cuisineCounts[c] = (cuisineCounts[c] || 0) + 1; });
    const dominantCuisineShare = Math.max(...Object.values(cuisineCounts)) / cuisineSequence.length;
    const cuisineFatigue = dominantCuisineShare > 0.5 ? 'low_variety' :
        dominantCuisineShare > 0.3 ? 'moderate_variety' : 'high_variety';

    // Calculate dish switching frequency
    let switchCount = 0;
    for (let i = 1; i < cuisineSequence.length; i++) {
        if (cuisineSequence[i] !== cuisineSequence[i - 1]) switchCount++;
    }
    const switchRate = cuisineSequence.length > 1 ? (switchCount / (cuisineSequence.length - 1) * 100) : 0;

    return {
        frequent_dishes: topDishes,
        dish_repeat_rate: Math.round(repeatRate),
        unique_dishes_tried: uniqueDishes,
        cuisine_fatigue_score: cuisineFatigue,
        dish_switching_rate: Math.round(switchRate),
        variety_seeker_score: Math.round(switchRate),
        stable_routine_score: Math.round(100 - switchRate),
        favorite_restaurants: Object.entries(restaurantCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, visits: count, loyalty_pct: Math.round((count / orders.length) * 100) }))
    };
};

// Calculate behavioral traits
const calculateBehavioralTraits = (orders, temporalData, priceData, repeatData) => {
    const traits = {};

    // Late night eater
    traits.late_night_eater = temporalData.late_night_eater;
    traits.late_night_score = Math.round((temporalData.time_of_day_curve.late_night / orders.length) * 100);

    // Spice preference (infer from items)
    let spicyCount = 0;
    orders.forEach(order => {
        if (/spicy|hot|chilli|pepper|masala|tikka|schezwan/i.test(order.items || '')) {
            spicyCount++;
        }
    });
    traits.spice_preference = spicyCount > orders.length * 0.4 ? 'spice_lover' :
        spicyCount > orders.length * 0.2 ? 'moderate_spice' : 'mild_preference';

    // Health orientation
    let healthyCount = 0;
    orders.forEach(order => {
        if (/salad|grilled|steamed|healthy|lite|diet|protein|veg/i.test(order.items || '')) {
            healthyCount++;
        }
    });
    traits.health_orientation_score = Math.round((healthyCount / orders.length) * 100);
    traits.health_conscious = healthyCount > orders.length * 0.2;

    // Variety seeker
    traits.variety_seeker_score = repeatData.variety_seeker_score;
    traits.variety_seeker = repeatData.variety_seeker_score > 60;

    // Impulsive vs planned buyer
    const weekendRatio = parseFloat(temporalData.weekday_vs_weekend_ratio) || 0;
    traits.impulsive_buyer_score = Math.round(weekendRatio * 30 + (100 - temporalData.weekly_consistency_score) * 0.7);
    traits.stable_routine_buyer = temporalData.weekly_consistency_score > 60;

    // Brand loyalty per brand
    const brandLoyalty = {};
    const brandOrders = {};
    orders.forEach(order => {
        const brand = inferBrand(order.restaurant || '');
        brandOrders[brand] = brandOrders[brand] || [];
        brandOrders[brand].push(order);
    });

    Object.entries(brandOrders).forEach(([brand, brandOrderList]) => {
        if (brandOrderList.length >= 3) {
            brandLoyalty[brand] = {
                order_count: brandOrderList.length,
                loyalty_score: Math.min(100, brandOrderList.length * 10),
                tier: brandOrderList.length >= 10 ? 'loyal' :
                    brandOrderList.length >= 5 ? 'regular' : 'occasional'
            };
        }
    });
    traits.per_brand_loyalty = brandLoyalty;

    return traits;
};

// Calculate competitor mapping and substitution patterns
const calculateCompetitorMapping = (orders) => {
    const brandSequence = [];
    const substitutionPairs = {};
    const categoryBrands = {};

    orders.forEach(order => {
        const brand = inferBrand(order.restaurant || '');
        const cuisine = inferCuisineFromItems(order.items || '');
        brandSequence.push({ brand, cuisine, restaurant: order.restaurant });

        // Group brands by cuisine/category
        if (!categoryBrands[cuisine]) categoryBrands[cuisine] = {};
        categoryBrands[cuisine][brand] = (categoryBrands[cuisine][brand] || 0) + 1;
    });

    // Track brand switches
    for (let i = 1; i < brandSequence.length; i++) {
        const prev = brandSequence[i - 1];
        const curr = brandSequence[i];

        if (prev.cuisine === curr.cuisine && prev.brand !== curr.brand) {
            const pairKey = [prev.brand, curr.brand].sort().join(' ↔ ');
            substitutionPairs[pairKey] = (substitutionPairs[pairKey] || 0) + 1;
        }
    }

    // Calculate switching probability
    let totalSwitches = 0;
    let sameBrandRepeats = 0;
    for (let i = 1; i < brandSequence.length; i++) {
        if (brandSequence[i].brand !== brandSequence[i - 1].brand) {
            totalSwitches++;
        } else {
            sameBrandRepeats++;
        }
    }

    const switchProbability = brandSequence.length > 1 ?
        Math.round((totalSwitches / (brandSequence.length - 1)) * 100) : 0;

    // Top substitution chains
    const topSubstitutions = Object.entries(substitutionPairs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pair, count]) => ({ brands: pair, switch_count: count }));

    // Competitor overlap by category
    const competitorOverlap = {};
    Object.entries(categoryBrands).forEach(([cuisine, brands]) => {
        const sortedBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]);
        if (sortedBrands.length > 1) {
            competitorOverlap[cuisine] = sortedBrands.slice(0, 3).map(([brand, count]) => ({ brand, orders: count }));
        }
    });

    return {
        substitution_chains: topSubstitutions,
        brand_switching_probability: switchProbability,
        brand_loyalty_vs_switching: sameBrandRepeats > totalSwitches ? 'loyal' : 'switcher',
        competitor_overlap_by_category: competitorOverlap,
        category_exploration_score: Object.keys(categoryBrands).length * 10
    };
};

// Calculate basket intelligence
const calculateBasketIntelligence = (orders) => {
    const basketSizes = [];
    const addOnCount = { drinks: 0, sides: 0, desserts: 0, extras: 0 };
    const cuisineBundles = {};
    let comboOrders = 0;
    const basketPatterns = {};

    orders.forEach(order => {
        const dishes = extractDishes(order.items || '');
        basketSizes.push(dishes.length);

        // Detect add-ons
        dishes.forEach(dish => {
            const lowerDish = dish.toLowerCase();
            if (/cola|pepsi|thumbs up|sprite|fanta|coke|juice|shake|lassi|coffee|tea|mojito/i.test(lowerDish)) {
                addOnCount.drinks++;
            } else if (/fries|chips|salad|soup|bread|naan|roti|rice/i.test(lowerDish)) {
                addOnCount.sides++;
            } else if (/ice cream|brownie|cake|gulab jamun|rasgulla|dessert|sweet/i.test(lowerDish)) {
                addOnCount.desserts++;
            }
        });

        // Detect combos
        if (/combo|meal|thali|platter|bucket/i.test(order.items || '')) {
            comboOrders++;
        }

        // Track basket patterns (for repeat detection)
        const basketKey = dishes.sort().join('|').toLowerCase();
        basketPatterns[basketKey] = (basketPatterns[basketKey] || 0) + 1;

        // Track cuisine bundles
        const cuisine = inferCuisineFromItems(order.items || '');
        if (!cuisineBundles[cuisine]) cuisineBundles[cuisine] = { count: 0, avgItems: 0, totalItems: 0 };
        cuisineBundles[cuisine].count++;
        cuisineBundles[cuisine].totalItems += dishes.length;
    });

    // Calculate averages
    const avgBasketSize = basketSizes.reduce((a, b) => a + b, 0) / basketSizes.length || 0;
    const basketDiversity = new Set(basketSizes).size / basketSizes.length || 0;

    // Update cuisine bundle averages
    Object.keys(cuisineBundles).forEach(cuisine => {
        cuisineBundles[cuisine].avgItems = Math.round(cuisineBundles[cuisine].totalItems / cuisineBundles[cuisine].count * 10) / 10;
        delete cuisineBundles[cuisine].totalItems;
    });

    // Repeat basket detection
    const repeatBaskets = Object.entries(basketPatterns)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([basket, count]) => ({ items: basket.split('|'), repeat_count: count }));

    return {
        average_basket_size: Math.round(avgBasketSize * 10) / 10,
        basket_diversity_score: Math.round(basketDiversity * 100),
        add_ons_analysis: {
            drinks_pct: Math.round((addOnCount.drinks / orders.length) * 100),
            sides_pct: Math.round((addOnCount.sides / orders.length) * 100),
            desserts_pct: Math.round((addOnCount.desserts / orders.length) * 100),
            add_on_propensity: (addOnCount.drinks + addOnCount.sides + addOnCount.desserts) / orders.length > 0.5 ? 'high' : 'low'
        },
        combo_preference: Math.round((comboOrders / orders.length) * 100),
        cuisine_bundles: cuisineBundles,
        repeat_baskets: repeatBaskets,
        upsell_receptivity: addOnCount.drinks + addOnCount.desserts > orders.length * 0.3 ? 'high' : 'moderate'
    };
};

// Calculate enhanced propensity scores
const calculatePropensityScores = (orders, temporalData, priceData, repeatData, basketData) => {
    const orderCount = orders.length;

    return {
        // Core propensities
        repeat_purchase_probability: Math.min(100, Math.round(orderCount * 2)),
        churn_risk: orderCount < 5 ? 70 : orderCount < 10 ? 40 : orderCount < 30 ? 20 : 10,

        // Category adoption
        new_category_adoption: repeatData.variety_seeker_score > 50 ? 'high' : 'moderate',
        premium_tier_probability: priceData.price_bucket_distribution.premium_pct + priceData.price_bucket_distribution.luxury_pct,

        // Cross-sell opportunities
        dessert_cross_sell: basketData.add_ons_analysis.desserts_pct < 20 ? 'high_potential' : 'saturated',
        beverage_cross_sell: basketData.add_ons_analysis.drinks_pct < 30 ? 'high_potential' : 'saturated',

        // Upsell scores
        upsell_receptivity_score: priceData.price_sensitivity_index < 50 ? 80 : 40,
        combo_upsell_probability: basketData.combo_preference < 30 ? 70 : 30,

        // Engagement predictions
        win_back_probability: temporalData.weekly_consistency_score > 60 ? 80 : 50,
        referral_propensity: orderCount > 30 && repeatData.dish_repeat_rate > 50 ? 'high' : 'moderate',

        // Timing-based
        weekend_activation_probability: parseFloat(temporalData.weekday_vs_weekend_ratio) < 0.5 ? 70 : 30,
        late_night_activation: temporalData.late_night_eater ? 80 : 20
    };
};

// ================================
// DATA QUALITY SCORING
// ================================

/**
 * Calculate comprehensive data quality score
 * Weighted signals (0-1 scale, multiplied by weight):
 * - price_coverage (20%): Orders with valid prices
 * - category_mapping (20%): Categories mapped to IAB/GS1
 * - brand_matching (15%): Orders matched to known brands
 * - timestamp_coverage (15%): Orders with parseable timestamps
 * - data_window_span (15%): Actual vs expected data window
 * - parsing_success (15%): Overall parsing success rate
 */
const calculateDataQualityScore = (orders, basketContents, cuisineCount, brandCount, orderDates, actualDataWindowDays) => {
    const totalOrders = orders.length;
    if (totalOrders === 0) {
        return { score: 0, breakdown: {}, completeness: 'empty' };
    }

    // 1. Price coverage (20%)
    const ordersWithPrice = orders.filter(o => parsePrice(o.price) > 0).length;
    const priceCoverage = ordersWithPrice / totalOrders;

    // 2. Category mapping (20%)
    const knownCategories = Object.keys(cuisineCount).filter(c => c !== 'Unknown').length;
    const totalCategories = Object.keys(cuisineCount).length;
    const unknownCount = cuisineCount['Unknown'] || 0;
    const categoryMapping = totalCategories > 0 ?
        (totalOrders - unknownCount) / totalOrders : 0;

    // 3. Brand matching (15%)
    const localCount = brandCount['Local Restaurant'] || 0;
    const brandMatching = (totalOrders - localCount) / totalOrders;

    // 4. Timestamp coverage (15%)
    const validTimestamps = orderDates?.length || 0;
    const timestampCoverage = validTimestamps / totalOrders;

    // 5. Data window span (15%)
    const expectedWindow = DATA_WINDOW_DAYS;
    const dataWindowSpan = Math.min(1, (actualDataWindowDays || 0) / expectedWindow);

    // 6. Parsing success (15%)
    const itemsParsed = basketContents?.length || 0;
    const avgItemsPerOrder = itemsParsed / totalOrders;
    const parsingSuccess = Math.min(1, avgItemsPerOrder / 1.5); // Expect avg 1.5 items

    // Calculate weighted score
    const weights = {
        price_coverage: 0.20,
        category_mapping: 0.20,
        brand_matching: 0.15,
        timestamp_coverage: 0.15,
        data_window_span: 0.15,
        parsing_success: 0.15
    };

    const signals = {
        price_coverage: Math.round(priceCoverage * 100),
        category_mapping: Math.round(categoryMapping * 100),
        brand_matching: Math.round(brandMatching * 100),
        timestamp_coverage: Math.round(timestampCoverage * 100),
        data_window_span: Math.round(dataWindowSpan * 100),
        parsing_success: Math.round(parsingSuccess * 100)
    };

    const weightedScore =
        priceCoverage * weights.price_coverage +
        categoryMapping * weights.category_mapping +
        brandMatching * weights.brand_matching +
        timestampCoverage * weights.timestamp_coverage +
        dataWindowSpan * weights.data_window_span +
        parsingSuccess * weights.parsing_success;

    // Determine completeness tier
    let completeness;
    if (weightedScore >= 0.8) completeness = 'excellent';
    else if (weightedScore >= 0.6) completeness = 'good';
    else if (weightedScore >= 0.4) completeness = 'partial';
    else completeness = 'limited';

    return {
        score: Math.round(weightedScore * 100) / 100,
        breakdown: signals,
        weights,
        completeness
    };
};
// ================================
// PII STRIPPING
// ================================

const PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(\+91[-.\s]?)?[6-9]\d{9}/g,
    name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    address: /\d+.*?(road|street|lane|nagar|colony|apartment|flat|floor|building).*?\d{6}/gi,
    pincode: /\b\d{6}\b/g,
    upi: /[\w.-]+@[a-z]+/gi,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    orderId: /\b(order|ORD|TXN)[-_]?[A-Z0-9]{6,}/gi
};

// Fields that should be completely redacted
const SENSITIVE_FIELDS = [
    'name', 'fullname', 'full_name', 'customer_name', 'user_name', 'username',
    'email', 'emailAddress', 'email_address',
    'phone', 'phoneNumber', 'phone_number', 'mobile', 'contact',
    'address', 'deliveryAddress', 'delivery_address', 'street', 'flat', 'house',
    'password', 'passwd', 'secret', 'token', 'apiKey', 'api_key',
    'cardNumber', 'card_number', 'cvv', 'expiry',
    'lat', 'lng', 'latitude', 'longitude', 'coordinates', 'location',
    'ip', 'ipAddress', 'ip_address', 'deviceId', 'device_id'
];

// Fields that should be partially masked (keep for analytics but anonymize)
const PARTIAL_MASK_FIELDS = ['orderId', 'order_id', 'transactionId', 'transaction_id'];

const stripPII = (text) => {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text;
    Object.values(PII_PATTERNS).forEach(pattern => {
        cleaned = cleaned.replace(pattern, '[REDACTED]');
    });
    return cleaned;
};

// Strip PII from entire object recursively
const stripPIIFromObject = (obj) => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return stripPII(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => stripPIIFromObject(item));
    }

    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();

            // Completely redact sensitive fields
            if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f.toLowerCase()))) {
                cleaned[key] = '[REDACTED]';
                continue;
            }

            // Partially mask certain IDs (keep last 4 chars)
            if (PARTIAL_MASK_FIELDS.some(f => lowerKey.includes(f.toLowerCase()))) {
                if (typeof value === 'string' && value.length > 4) {
                    cleaned[key] = '****' + value.slice(-4);
                } else {
                    cleaned[key] = value;
                }
                continue;
            }

            // Recursively clean nested objects
            cleaned[key] = stripPIIFromObject(value);
        }
        return cleaned;
    }

    return obj;
};

// ================================
// DATA ENRICHMENT  
// ================================

// Infer brand from restaurant name
const inferBrand = (restaurantName) => {
    if (!restaurantName) return 'Local Restaurant';

    for (const { pattern, brand } of BRAND_PATTERNS) {
        if (pattern.test(restaurantName)) {
            return brand;
        }
    }

    return 'Local Restaurant';
};

// Categorize cuisine/food type
const categorizeFood = (cuisine, items) => {
    const cuisineLower = (cuisine || '').toLowerCase();

    // Check cuisine mapping
    for (const [key, value] of Object.entries(FOOD_CATEGORIES)) {
        if (cuisineLower.includes(key)) {
            return value;
        }
    }

    // Check items for category hints
    if (items && items.length > 0) {
        const itemNames = items.map(i => (i.name || '').toLowerCase()).join(' ');
        for (const [key, value] of Object.entries(FOOD_CATEGORIES)) {
            if (itemNames.includes(key)) {
                return value;
            }
        }
    }

    return FOOD_CATEGORIES.default;
};

// Calculate spend bracket
const getSpendBracket = (totalSpend) => {
    if (totalSpend >= 50000) return 'premium';      // > ₹50k
    if (totalSpend >= 20000) return 'high';         // ₹20k - ₹50k  
    if (totalSpend >= 5000) return 'medium';        // ₹5k - ₹20k
    return 'budget';                                 // < ₹5k
};

// Get order frequency tier
const getOrderFrequency = (orderCount, daySpan = 90) => {
    const ordersPerMonth = (orderCount / daySpan) * 30;
    if (ordersPerMonth >= 20) return 'super_active';   // 20+/month
    if (ordersPerMonth >= 10) return 'active';         // 10-20/month
    if (ordersPerMonth >= 4) return 'regular';         // 4-10/month
    return 'occasional';                               // < 4/month
};

// Anonymize location to geo bucket
const anonymizeLocation = (pincode, city) => {
    if (pincode && pincode.length === 6) {
        return pincode.substring(0, 3) + 'xxx';  // Keep first 3 digits only
    }
    if (city) {
        return city.toLowerCase().replace(/[^a-z]/g, '').substring(0, 4) + '_region';
    }
    return 'unknown_region';
};

// Generate cohort ID (k-anonymity friendly)
const generateCohortId = (provider, spendBracket, frequency, geo) => {
    return `${provider}_${geo}_${spendBracket}_${frequency}`;
};

// ================================
// GEMINI ENRICHMENT
// ================================

const callGeminiAPI = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('🤖 DEBUG - GEMINI_API_KEY present:', !!apiKey);
    if (!apiKey) {
        console.log('❌ GEMINI_API_KEY not set in environment');
        return null;
    }

    try {
        console.log('🤖 Calling Gemini API...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
                })
            }
        );

        console.log('🤖 Gemini API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error response:', errorText);
            return null;
        }
        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        console.log('🤖 Gemini response received:', result ? 'yes' : 'no');
        return result;
    } catch (error) {
        console.error('Gemini API error:', error);
        return null;
    }
};

const enrichWithGemini = async (orderData, provider) => {
    const prompt = `Analyze this food delivery order data and extract insights. Return ONLY valid JSON.

Provider: ${provider}
Data: ${JSON.stringify(orderData).substring(0, 3000)}

Return JSON with:
{
  "total_orders": number,
  "avg_order_value": number,
  "total_spend": number,
  "preferred_cuisines": ["cuisine1", "cuisine2"],
  "preferred_brands": ["brand1", "brand2"],
  "dietary_preference": "veg/non-veg/mixed",
  "peak_ordering_times": ["lunch", "dinner", "late-night"],
  "order_frequency_category": "occasional/regular/active/super_active",
  "spend_category": "budget/medium/high/premium",
  "top_categories": [{"category": "name", "order_count": number}],
  "behavioral_tags": ["tag1", "tag2"]
}`;

    const response = await callGeminiAPI(prompt);

    if (response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse Gemini response');
        }
    }

    return null;
};

// ================================
// MAIN TRANSFORMATION PIPELINE
// ================================

export const transformToSellableData = async (rawData, provider, userId) => {
    console.log(`📦 Transforming ${provider} data to sellable format...`);

    const config = DATASET_CONFIG[provider] || DATASET_CONFIG.zomato;
    const timestamp = new Date().toISOString();

    // Step 1: Parse and clean raw data
    console.log('🧹 Step 1: Ingestion & Cleaning...');
    let parsedData;
    try {
        parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
        parsedData = rawData;
    }

    // DEBUG: Log the structure of parsed data
    console.log('📋 DEBUG - Parsed data keys:', Object.keys(parsedData || {}));
    console.log('📋 DEBUG - Full parsed data:', JSON.stringify(parsedData, null, 2).substring(0, 2000));

    // Step 2: Extract orders - check multiple possible structures
    let orders = parsedData?.orders || parsedData?.orderHistory || parsedData?.data?.orders || [];

    // If orders is still empty, check if parsedData itself is the order array
    if (orders.length === 0 && Array.isArray(parsedData)) {
        orders = parsedData;
    }

    console.log('📋 DEBUG - Orders found:', orders.length);

    // Note: Using global parsePrice function defined at top of file

    const validOrders = orders.filter(o => {
        const value = parsePrice(o.price) || o.totalCost || o.order_total || o.amount || o.total || 0;
        return value > 0;
    });

    console.log('📋 DEBUG - Valid orders after filtering:', validOrders.length);

    // Step 3: Calculate aggregated metrics
    console.log('📊 Step 2: Aggregating metrics...');
    let totalSpend = 0;
    let orderCount = validOrders.length || orders.length || parsedData?.totalOrders || parsedData?.orderCount || 0;
    const cuisineCount = {};
    const brandCount = {};
    const basketContents = [];

    validOrders.forEach(order => {
        const value = parsePrice(order.price) || order.totalCost || order.order_total || order.amount || order.total || 0;
        totalSpend += value;

        // Infer cuisine from items string (Zomato uses items like "1 x Chicken Biryani")
        const itemsStr = order.items || '';
        const inferredCuisine = inferCuisineFromItems(itemsStr);
        const cuisine = order.cuisine || order.restaurant_cuisine || inferredCuisine;
        cuisineCount[cuisine] = (cuisineCount[cuisine] || 0) + 1;

        // Check for 'restaurant' field (Zomato uses this)
        const restaurantName = order.restaurant || order.restaurantName || order.restaurant_name || '';
        const brand = inferBrand(restaurantName);
        brandCount[brand] = (brandCount[brand] || 0) + 1;

        // Process items - Zomato has items as a string like "1 x Chicken Biryani"
        const itemsData = order.items || order.order_items || [];
        const itemsArray = Array.isArray(itemsData) ? itemsData :
            (typeof itemsData === 'string' ? [{ name: itemsData, price: order.price }] : []);

        // Get food category based on inferred cuisine
        const categoryKey = inferredCuisine.toLowerCase().replace(/[&\s]/g, '_');
        const category = FOOD_CATEGORIES[categoryKey] || categorizeFood(cuisine, itemsArray);

        itemsArray.forEach(item => {
            basketContents.push({
                category_l1: category.l1,
                category_l2: category.l2,
                brand_inferred: brand,
                item_price: parsePrice(item.price) || parsePrice(order.price) || 0,
                quantity: item.quantity || 1,
                is_veg: item.isVeg || item.is_veg || null,
                inferred_cuisine: inferredCuisine
            });
        });
    });

    // Step 4: Enrich with Gemini (optional - graceful fallback if unavailable)
    console.log('🧠 Step 3: Enrichment with AI (optional)...');
    let geminiInsights = null;
    const useGemini = process.env.GEMINI_API_KEY && process.env.USE_GEMINI !== 'false';

    if (useGemini) {
        try {
            geminiInsights = await enrichWithGemini(parsedData, provider);
            if (geminiInsights) {
                console.log('✅ Gemini enrichment successful');
            } else {
                console.log('⚠️ Gemini enrichment returned null, using fallback');
            }
        } catch (e) {
            console.log('⚠️ Gemini enrichment failed, using fallback:', e.message);
        }
    } else {
        console.log('ℹ️ Gemini enrichment disabled or API key not set');
    }

    // Step 5: Generate anonymized attributes
    console.log('🔐 Step 4: Anonymization...');
    const avgOrderValue = orderCount > 0 ? Math.round(totalSpend / orderCount) : 0;
    const spendBracket = getSpendBracket(totalSpend);
    const frequency = getOrderFrequency(orderCount);

    // Sort cuisines and brands by frequency
    const topCuisines = Object.entries(cuisineCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cuisine]) => cuisine);

    const topBrands = Object.entries(brandCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([brand]) => brand);

    // Step 6: Build sellable record with ENTERPRISE ANALYTICS
    console.log('📦 Step 5: Building sellable record...');
    console.log('📊 Computing enterprise analytics...');

    // Calculate all enterprise analytics
    const restaurants = validOrders.map(o => o.restaurant || '').filter(r => r);
    const temporalAnalytics = calculateTemporalBehavior(validOrders);
    const priceAnalytics = calculatePriceSensitivity(validOrders);
    const repeatAnalytics = calculateRepeatPatterns(validOrders);
    const basketAnalytics = calculateBasketIntelligence(validOrders);
    const behavioralTraits = calculateBehavioralTraits(validOrders, temporalAnalytics, priceAnalytics, repeatAnalytics);
    const competitorMapping = calculateCompetitorMapping(validOrders);
    const propensityScores = calculatePropensityScores(validOrders, temporalAnalytics, priceAnalytics, repeatAnalytics, basketAnalytics);
    const geoInference = inferCityTier(restaurants, parsedData?.DYNAMIC_GEO);

    // Generate DETERMINISTIC cohort ID using city cluster
    // Formula: {platform}_{city_cluster}_{spend_tier}_{frequency_tier}
    const geoAnon = anonymizeLocation(parsedData?.pincode, parsedData?.city);
    const cohortId = generateDeterministicCohortId(
        provider,
        geoInference.city_cluster || geoAnon,
        spendBracket,
        frequency
    );
    console.log(`🏷️ Cohort ID: ${cohortId}`);

    console.log('✅ Enterprise analytics computed');

    // Calculate actual last order date and order dates array
    const orderDates = validOrders
        .map(o => parseOrderTimestamp(o.timestamp))
        .filter(d => d)
        .sort((a, b) => b - a);
    const lastOrderDate = orderDates[0] || null;
    const firstOrderDate = orderDates[orderDates.length - 1] || null;
    const daysSinceLastOrder = lastOrderDate ? Math.round((new Date() - lastOrderDate) / (1000 * 60 * 60 * 24)) : null;

    // Data window provenance
    const dataWindowStart = firstOrderDate ? dayjs(firstOrderDate).format('YYYY-MM-DD') : null;
    const dataWindowEnd = lastOrderDate ? dayjs(lastOrderDate).format('YYYY-MM-DD') : null;
    const actualDataWindowDays = (firstOrderDate && lastOrderDate) ?
        Math.round((lastOrderDate - firstOrderDate) / (1000 * 60 * 60 * 24)) : DATA_WINDOW_DAYS;

    // Calculate actual avg days between orders using inter-order diffs
    let avgDaysBetweenOrders = null;
    if (orderDates.length > 1) {
        const interOrderDiffs = [];
        for (let i = 1; i < orderDates.length; i++) {
            const diffDays = Math.round((orderDates[i - 1] - orderDates[i]) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) interOrderDiffs.push(diffDays);
        }
        if (interOrderDiffs.length > 0) {
            avgDaysBetweenOrders = Math.round(interOrderDiffs.reduce((a, b) => a + b, 0) / interOrderDiffs.length);
        }
    }
    // Fallback to estimate if no valid diffs
    if (avgDaysBetweenOrders === null && orderCount > 1) {
        avgDaysBetweenOrders = Math.round(actualDataWindowDays / orderCount);
    }

    const ordersPerMonth = Math.round((orderCount / (actualDataWindowDays || DATA_WINDOW_DAYS)) * 30 * 10) / 10;
    const estimatedMonthlySpend = orderCount > 0 ? Math.round((totalSpend / orderCount) * (30 / (avgDaysBetweenOrders || 30))) : 0;

    // Normalized brand loyalty score (top brand share as percentage)
    const topBrandCount = topBrands.length > 0 ? (brandCount[topBrands[0]] || 0) : 0;
    const normalizedBrandLoyaltyScore = orderCount > 0 ? Math.round((topBrandCount / orderCount) * 100) : 0;

    // Calculate data quality score
    const dataQuality = calculateDataQualityScore(
        validOrders,
        basketContents,
        cuisineCount,
        brandCount,
        orderDates,
        actualDataWindowDays
    );
    console.log(`📊 Data quality score: ${dataQuality.score} (${dataQuality.completeness})`);

    // IAB Content Taxonomy categories for food
    const iabCategories = {
        'Fast Food': 'IAB8-5',
        'Pizza': 'IAB8-5',
        'Burgers': 'IAB8-5',
        'Regional Cuisine': 'IAB8-9',
        'Asian Cuisine': 'IAB8-9',
        'Western Cuisine': 'IAB8-9',
        'Health Food': 'IAB8-12',
        'Beverages': 'IAB8-4',
        'Desserts & Sweets': 'IAB8-6',
        'Food & Dining': 'IAB8-1'
    };

    // GS1 Food Categories mapping
    const gs1Categories = {
        'Biryani & Rice': 'GS1-10000043',
        'Chinese': 'GS1-10000044',
        'North Indian': 'GS1-10000043',
        'South Indian': 'GS1-10000043',
        'Pizza & Italian': 'GS1-10000045',
        'Burgers': 'GS1-10000046',
        'Fried Chicken': 'GS1-10000047',
        'Sandwiches': 'GS1-10000048',
        'Desserts': 'GS1-10000049',
        'Beverages': 'GS1-10000050'
    };

    const sellableRecord = {
        // === STANDARD IDENTIFIERS ===
        schema_version: '2.0',
        dataset_id: config.dataset_id,
        record_type: 'consumer_behavior_profile',
        generated_at: timestamp,

        // === AUDIENCE SEGMENT (IAB Taxonomy) ===
        audience_segment: {
            segment_id: cohortId,
            iab_categories: topCuisines.slice(0, 3).map(c => {
                const cat = categorizeFood(c, []);
                return iabCategories[cat.l1] || 'IAB8-1';
            }),

            // DMP-compatible attributes
            dmp_attributes: {
                interest_food_delivery: true,
                interest_dining_out: true,
                interest_cuisine_types: topCuisines,
                lifestyle_segment: spendBracket === 'premium' ? 'affluent' :
                    spendBracket === 'high' ? 'upper_middle' :
                        spendBracket === 'medium' ? 'middle_class' : 'value_conscious'
            }
        },

        // === TRANSACTION INTELLIGENCE ===
        transaction_data: {
            summary: {
                total_orders: orderCount,
                total_gmv: Math.round(totalSpend),
                avg_order_value: avgOrderValue,
                currency: 'INR',
                data_window_days: actualDataWindowDays,
                data_window_start: dataWindowStart,
                data_window_end: dataWindowEnd,
                platform: config.platform
            },

            frequency_metrics: {
                orders_per_month: ordersPerMonth,
                avg_days_between_orders: avgDaysBetweenOrders,
                avg_days_computed_from: orderDates.length > 1 ? 'inter_order_diffs' : 'estimated',
                estimated_monthly_spend: estimatedMonthlySpend,
                frequency_tier: frequency
            },

            recency: {
                last_order_date: lastOrderDate ? dayjs(lastOrderDate).format('YYYY-MM-DD HH:mm') : null,
                last_order_computed_from: 'sorted_order_timestamps',
                days_since_last_order: daysSinceLastOrder,
                rfm_recency_score: daysSinceLastOrder !== null ?
                    (daysSinceLastOrder < 7 ? 5 : daysSinceLastOrder < 30 ? 4 : daysSinceLastOrder < 90 ? 3 : 2) : 1
            }
        },

        // === BRAND & CATEGORY INTELLIGENCE ===
        brand_intelligence: {
            top_brands: topBrands.slice(0, 10).map((brand, idx) => ({
                brand_name: brand,
                rank: idx + 1,
                is_chain: brand !== 'Local Restaurant',
                category: 'QSR',
                order_share_pct: Math.round((brandCount[brand] / orderCount) * 100)
            })),

            brand_loyalty_score: normalizedBrandLoyaltyScore,
            brand_loyalty_scale: '0-100 (top brand share as % of total orders)',
            chain_vs_local_preference: topBrands[0] !== 'Local Restaurant' ? 'chain_preferred' : 'local_preferred',

            // Competitor intelligence (valuable for brands)
            competitor_exposure: topBrands.filter(b => b !== 'Local Restaurant').slice(0, 5)
        },

        // === CATEGORY INSIGHTS ===
        category_insights: {
            top_categories: Object.entries(cuisineCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([category, count], idx) => ({
                    category_name: category,
                    iab_code: iabCategories[categorizeFood(category, []).l1] || 'IAB8-1',
                    gs1_code: gs1Categories[category] || 'GS1-10000000',
                    order_count: count,
                    share_of_wallet: ((count / orderCount) * 100).toFixed(1) + '%',
                    rank: idx + 1
                })),

            dietary_signals: {
                preference: geminiInsights?.dietary_preference || behavioralTraits.health_conscious ? 'health_oriented' : 'mixed',
                health_conscious: behavioralTraits.health_conscious,
                variety_seeker: repeatAnalytics.variety_seeker_score > 60,
                spice_preference: behavioralTraits.spice_preference
            }
        },

        // === CONSUMER PROFILE ===
        consumer_profile: {
            spend_tier: spendBracket,
            loyalty_tier: orderCount >= 50 ? 'platinum' : orderCount >= 20 ? 'gold' : orderCount >= 10 ? 'silver' : 'bronze',
            engagement_level: frequency,

            // Timing preferences from temporal analytics
            timing_preferences: {
                peak_order_day: temporalAnalytics.peak_ordering_day,
                peak_order_time: temporalAnalytics.peak_ordering_time,
                weekend_preference: parseFloat(temporalAnalytics.weekday_vs_weekend_ratio) > 0.5 ? 'weekend_heavy' : 'weekday_focused'
            }
        },

        // === TEMPORAL BEHAVIOR (NEW) ===
        temporal_behavior: {
            day_of_week_distribution: temporalAnalytics.day_of_week_distribution,
            time_of_day_curve: temporalAnalytics.time_of_day_curve,
            peak_ordering_day: temporalAnalytics.peak_ordering_day,
            peak_ordering_time: temporalAnalytics.peak_ordering_time,
            weekday_vs_weekend_ratio: temporalAnalytics.weekday_vs_weekend_ratio,
            weekly_consistency_score: temporalAnalytics.weekly_consistency_score,
            month_spend_pattern: temporalAnalytics.month_spend_pattern,
            late_night_eater: temporalAnalytics.late_night_eater
        },

        // === PRICE SENSITIVITY (NEW) ===
        price_sensitivity: {
            price_bucket_distribution: priceAnalytics.price_bucket_distribution,
            dominant_price_segment: priceAnalytics.dominant_price_segment,
            discount_usage_rate: priceAnalytics.discount_usage_rate,
            offer_dependent: priceAnalytics.offer_dependent,
            price_sensitivity_index: priceAnalytics.price_sensitivity_index,
            elasticity_score: priceAnalytics.elasticity_score,
            premium_vs_budget_ratio: priceAnalytics.premium_vs_budget_ratio
        },

        // === REPEAT PATTERNS (NEW) ===
        repeat_patterns: {
            frequent_dishes: repeatAnalytics.frequent_dishes,
            dish_repeat_rate: repeatAnalytics.dish_repeat_rate,
            unique_dishes_tried: repeatAnalytics.unique_dishes_tried,
            cuisine_fatigue_score: repeatAnalytics.cuisine_fatigue_score,
            dish_switching_rate: repeatAnalytics.dish_switching_rate,
            favorite_restaurants: repeatAnalytics.favorite_restaurants
        },

        // === BEHAVIORAL TRAITS (NEW) ===
        behavioral_traits: {
            late_night_eater: behavioralTraits.late_night_eater,
            late_night_score: behavioralTraits.late_night_score,
            spice_preference: behavioralTraits.spice_preference,
            health_orientation_score: behavioralTraits.health_orientation_score,
            health_conscious: behavioralTraits.health_conscious,
            variety_seeker_score: behavioralTraits.variety_seeker_score,
            variety_seeker: behavioralTraits.variety_seeker,
            impulsive_buyer_score: behavioralTraits.impulsive_buyer_score,
            stable_routine_buyer: behavioralTraits.stable_routine_buyer,
            per_brand_loyalty: behavioralTraits.per_brand_loyalty
        },

        // === COMPETITOR MAPPING (NEW) ===
        competitor_mapping: {
            substitution_chains: competitorMapping.substitution_chains,
            brand_switching_probability: competitorMapping.brand_switching_probability,
            brand_loyalty_vs_switching: competitorMapping.brand_loyalty_vs_switching,
            competitor_overlap_by_category: competitorMapping.competitor_overlap_by_category,
            category_exploration_score: competitorMapping.category_exploration_score
        },

        // === BASKET INTELLIGENCE (NEW) ===
        basket_intelligence: {
            average_basket_size: basketAnalytics.average_basket_size,
            basket_diversity_score: basketAnalytics.basket_diversity_score,
            add_ons_analysis: basketAnalytics.add_ons_analysis,
            combo_preference: basketAnalytics.combo_preference,
            cuisine_bundles: basketAnalytics.cuisine_bundles,
            repeat_baskets: basketAnalytics.repeat_baskets,
            upsell_receptivity: basketAnalytics.upsell_receptivity
        },

        // === PROPENSITY PREDICTIONS (NEW) ===
        propensity_predictions: {
            repeat_purchase_probability: propensityScores.repeat_purchase_probability,
            churn_risk: propensityScores.churn_risk,
            new_category_adoption: propensityScores.new_category_adoption,
            premium_tier_probability: propensityScores.premium_tier_probability,
            dessert_cross_sell: propensityScores.dessert_cross_sell,
            beverage_cross_sell: propensityScores.beverage_cross_sell,
            upsell_receptivity_score: propensityScores.upsell_receptivity_score,
            combo_upsell_probability: propensityScores.combo_upsell_probability,
            win_back_probability: propensityScores.win_back_probability,
            referral_propensity: propensityScores.referral_propensity,
            weekend_activation_probability: propensityScores.weekend_activation_probability,
            late_night_activation: propensityScores.late_night_activation
        },

        // === GEO INTELLIGENCE (ENHANCED) ===
        geo_data: {
            geo_bucket: geoAnon,
            country: 'IN',
            city_tier: geoInference.tier,
            city_cluster: geoInference.city_cluster,
            geo_inference_method: 'restaurant_name_pattern_matching',
            neighborhood_affluence_index: spendBracket === 'premium' ? 'high' :
                spendBracket === 'high' ? 'upper_middle' :
                    spendBracket === 'medium' ? 'middle' : 'value'
        },

        // === SAMPLE BASKET DATA ===
        basket_samples: basketContents.slice(0, 15).map(item => ({
            category_l1: item.category_l1,
            category_l2: item.category_l2,
            brand: item.brand_inferred,
            price_bucket: item.item_price > 300 ? 'high' : item.item_price > 150 ? 'medium' : 'low',
            inferred_cuisine: item.inferred_cuisine
        })),

        // === METADATA & COMPLIANCE ===
        metadata: {
            source: 'reclaim_protocol',
            schema_standard: 'myrad_consumer_intelligence_v2',
            verification: {
                status: 'zk_verified',
                proof_type: 'zero_knowledge',
                attestor: 'reclaim_network'
            },
            privacy_compliance: {
                pii_stripped: true,
                k_anonymity_threshold: MIN_K_ANONYMITY,
                k_anonymity_compliant: null, // Will be updated post-save when cohort size is known
                k_anonymity_note: `Compliance verified when cohort size >= ${MIN_K_ANONYMITY}`,
                gdpr_compatible: true,
                ccpa_compatible: true
            },
            data_quality: {
                score: dataQuality.score,
                score_breakdown: dataQuality.breakdown,
                enrichment_applied: [
                    'brand_inference',
                    'category_mapping',
                    'temporal_analytics',
                    'price_sensitivity',
                    'repeat_patterns',
                    'behavioral_traits',
                    'competitor_mapping',
                    'basket_intelligence',
                    'propensity_scoring',
                    'geo_inference',
                    ...(geminiInsights ? ['ai_enrichment'] : [])
                ],
                completeness: dataQuality.completeness,
                ml_ready: dataQuality.score >= 0.6
            },
            commercial_compatibility: {
                iab_taxonomy: true,
                gs1_food_codes: true,
                dmp_friendly: true,
                audience_segment_ready: true,
                retail_media_quality: true
            }
        }
    };

    // Step 6: Strip PII from raw data for storage
    console.log('🔐 Step 5: Stripping PII from raw data...');
    const piiStrippedRawData = stripPIIFromObject(parsedData);

    console.log('✅ Transformation complete!');

    return {
        sellableRecord,
        rawProcessed: {
            orderCount,
            totalSpend,
            avgOrderValue,
            topCuisines,
            topBrands
        },
        piiStrippedData: piiStrippedRawData,
        geminiInsights
    };
};

// ================================
// EXPORT FOR ENTERPRISE API
// ================================

export const generateDatasetExport = (contributions, format = 'jsonl') => {
    const records = contributions
        .filter(c => c.sellableData)
        .map(c => c.sellableData);

    if (format === 'jsonl') {
        return records.map(r => JSON.stringify(r)).join('\n');
    }

    return JSON.stringify(records, null, 2);
};

export default {
    transformToSellableData,
    generateDatasetExport,
    stripPIIFromObject,
    inferBrand,
    categorizeFood,
    getSpendBracket,
    anonymizeLocation
};
