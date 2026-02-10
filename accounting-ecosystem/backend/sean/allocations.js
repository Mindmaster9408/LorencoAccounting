/**
 * ============================================================================
 * SEAN AI — Bank Allocation Categories & Keywords
 * ============================================================================
 * Ported from sean-webapp/lib/bank-allocations.ts
 * 40+ SA accounting categories with 500+ SA-specific keywords.
 * 100% LOCAL — Zero external API calls.
 * ============================================================================
 */

// ─── Comprehensive SA Allocation Categories ──────────────────────────────────

const ALLOCATION_CATEGORIES = [
  {
    code: 'BANK_CHARGES',
    label: 'Bank Charges',
    keywords: [
      'bank fee', 'service fee', 'atm', 'card fee', 'monthly fee', 'admin fee',
      'cash handling', 'account fee', 'cheque fee', 'statement fee', 'swift',
      'fnb fee', 'absa fee', 'nedbank fee', 'standard bank fee', 'capitec fee',
      'card replacement', 'debit order fee', 'eft fee', 'notification fee',
      'overdraft fee', 'stop order fee', 'unpaid fee', 'dishonour fee',
      'withdrawal fee', 'enquiry fee', 'balance enquiry'
    ]
  },
  {
    code: 'TELEPHONE',
    label: 'Telephone & Communications',
    keywords: [
      'telkom', 'vodacom', 'mtn', 'cell c', 'fibre', 'internet', 'airtime',
      'rain', 'afrihost', 'webafrica', 'cool ideas', 'vox', 'rsaweb',
      'neotel', 'liquid telecom', 'openserve', 'herotel', 'frogfoot',
      'data bundle', 'mobile', 'cellular', 'telecoms', 'broadband', 'adsl',
      'vdsl', 'lte', '5g', 'wifi', 'wi-fi', 'telephone line', 'voip',
      'microsoft teams', 'zoom subscription', 'skype'
    ]
  },
  {
    code: 'ELECTRICITY',
    label: 'Electricity & Utilities',
    keywords: [
      'eskom', 'city power', 'electricity', 'prepaid', 'municipal',
      'city of johannesburg', 'city of cape town', 'city of tshwane',
      'ethekwini', 'ekurhuleni', 'nelson mandela bay', 'buffalo city',
      'mangaung', 'power', 'kwh', 'kilowatt', 'electric', 'utility',
      'smart meter', 'meter reading'
    ]
  },
  {
    code: 'WATER',
    label: 'Water & Rates',
    keywords: [
      'water', 'rates', 'municipal', 'refuse', 'sewage', 'sanitation',
      'waste removal', 'property rates', 'assessment rates', 'joburg water',
      'rand water', 'umgeni water'
    ]
  },
  {
    code: 'RENT',
    label: 'Rent & Premises',
    keywords: [
      'rent', 'lease', 'premises', 'property', 'rental', 'tenancy',
      'landlord', 'letting', 'office space', 'warehouse', 'storage',
      'parking', 'monthly rent', 'commercial rent', 'industrial rent'
    ]
  },
  {
    code: 'SALARIES',
    label: 'Salaries & Wages',
    keywords: [
      'salary', 'wage', 'payroll', 'staff', 'employee', 'nett pay',
      'net salary', 'gross salary', 'commission', 'bonus', 'overtime',
      'leave pay', 'thirteenth cheque', '13th cheque'
    ]
  },
  {
    code: 'PAYE',
    label: 'PAYE & Employee Tax',
    keywords: [
      'paye', 'pay as you earn', 'employee tax', 'sars paye', 'efiling paye',
      'tax deduction', 'income tax deduction'
    ]
  },
  {
    code: 'UIF',
    label: 'UIF Contributions',
    keywords: [
      'uif', 'unemployment insurance', 'uif contribution', 'labour department',
      'department of labour'
    ]
  },
  {
    code: 'SDL',
    label: 'Skills Development Levy',
    keywords: [
      'sdl', 'skills development', 'skills levy', 'seta', 'training levy'
    ]
  },
  {
    code: 'FUEL',
    label: 'Fuel & Motor Expenses',
    keywords: [
      'fuel', 'petrol', 'diesel', 'engen', 'shell', 'bp', 'caltex', 'sasol',
      'total', 'puma energy', 'astron', 'ez gas',
      'motorist', 'garage', 'filling station', 'service station',
      'car wash', 'oil change', 'tyre', 'tire', 'battery', 'motor spares',
      'autozone', 'midas', 'tiger wheel', 'supa quick', 'hi-q',
      'dunlop', 'goodyear', 'bridgestone', 'vehicle service', 'car service',
      'toll', 'n1 toll', 'n3 toll', 'sanral', 'etoll', 'e-toll'
    ]
  },
  {
    code: 'INSURANCE',
    label: 'Insurance',
    keywords: [
      'insurance', 'sanlam', 'old mutual', 'discovery', 'outsurance', 'santam',
      'hollard', 'momentum', 'liberty', 'pps', 'clientele', 'telesure',
      'dial direct', 'budget insurance', 'miway', 'king price', 'first for women',
      'auto & general', 'ooba', 'hippo', 'policy', 'premium', 'cover',
      'indemnity', 'assurance', 'short term', 'long term', 'life cover',
      'vehicle insurance', 'car insurance', 'building insurance',
      'contents insurance', 'business insurance', 'liability insurance'
    ]
  },
  {
    code: 'STATIONERY',
    label: 'Stationery & Office Supplies',
    keywords: [
      'stationery', 'office', 'waltons', 'makro', 'supplies', 'paper',
      'toner', 'ink', 'cartridge', 'pen', 'printer', 'ream', 'files',
      'folders', 'envelopes', 'staples', 'clip', 'tape', 'glue',
      'takealot office', 'incredible connection', 'game office',
      'cna', 'exclusive books', 'office national', 'konica minolta'
    ]
  },
  {
    code: 'PROFESSIONAL_FEES',
    label: 'Professional Fees',
    keywords: [
      'attorney', 'lawyer', 'accountant', 'audit', 'consulting', 'consultant',
      'legal', 'advocate', 'counsel', 'tax practitioner', 'bookkeeper',
      'financial advisor', 'advisor', 'advisory', 'professional service',
      'deloitte', 'pwc', 'kpmg', 'ey', 'ernst young', 'bdo', 'mazars',
      'grant thornton', 'rsm', 'moore', 'nolands', 'saica', 'saipa'
    ]
  },
  {
    code: 'ADVERTISING',
    label: 'Advertising & Marketing',
    keywords: [
      'advertising', 'marketing', 'facebook', 'google ads', 'promo',
      'instagram', 'linkedin', 'twitter', 'social media', 'seo',
      'digital marketing', 'print media', 'radio', 'billboard', 'signage',
      'flyer', 'brochure', 'business card', 'banner', 'promotional',
      'sponsorship', 'media24', 'naspers', 'multichoice', 'dstv ad',
      'cape talk', '702', 'jacaranda fm', 'east coast radio'
    ]
  },
  {
    code: 'REPAIRS',
    label: 'Repairs & Maintenance',
    keywords: [
      'repair', 'maintenance', 'service', 'fix', 'plumber', 'electrician',
      'handyman', 'contractor', 'building maintenance', 'aircon',
      'air conditioning', 'hvac', 'pest control', 'cleaning service',
      'garden service', 'landscaping', 'painting', 'renovation',
      'builders warehouse', 'cashbuild', 'mica', 'tile africa'
    ]
  },
  {
    code: 'ENTERTAINMENT',
    label: 'Entertainment & Meals',
    keywords: [
      'entertainment', 'restaurant', 'catering', 'meal', 'lunch', 'dinner',
      'breakfast', 'coffee', 'cafe', 'wimpy', 'spur', 'nandos', 'steers',
      'mcdonalds', 'kfc', 'burger king', 'debonairs', 'romans', 'fishaways',
      'ocean basket', 'news cafe', 'mugg bean', 'vida', 'seattle',
      'starbucks', 'woolworths food', 'client entertainment', 'staff function'
    ]
  },
  {
    code: 'GROCERIES',
    label: 'Groceries & Consumables',
    keywords: [
      'groceries', 'food', 'pick n pay', 'checkers', 'shoprite', 'spar',
      'woolworths', 'food lover', 'fruit veg', 'makro food', 'game food',
      'kitchen', 'tea', 'coffee', 'milk', 'sugar', 'snacks', 'refreshments',
      'staff kitchen', 'office supplies food'
    ]
  },
  {
    code: 'SUBSCRIPTIONS',
    label: 'Subscriptions & Software',
    keywords: [
      'subscription', 'software', 'license', 'microsoft', 'adobe', 'zoom',
      'dropbox', 'google workspace', 'office 365', 'xero', 'sage',
      'quickbooks', 'pastel', 'payspace', 'simplepay', 'slack', 'asana',
      'monday', 'notion', 'canva', 'mailchimp', 'hubspot', 'salesforce',
      'netflix', 'showmax', 'dstv', 'apple', 'spotify', 'youtube premium',
      'linkedin premium', 'domain registration', 'hosting', 'aws', 'azure'
    ]
  },
  {
    code: 'TRANSPORT',
    label: 'Transport & Delivery',
    keywords: [
      'courier', 'delivery', 'transport', 'uber', 'bolt', 'taxi',
      'the courier guy', 'ram', 'fastway', 'dawn wing', 'dhl', 'fedex',
      'ups', 'postnet', 'post office', 'aramex', 'time freight',
      'super group', 'imperial', 'flight', 'bus ticket', 'train',
      'gautrain', 'prasa', 'greyhound', 'intercape', 'translux'
    ]
  },
  {
    code: 'TRAVEL',
    label: 'Travel & Accommodation',
    keywords: [
      'flight', 'airline', 'saa', 'flysafair', 'kulula', 'mango', 'airlink',
      'british airways', 'emirates', 'qatar', 'hotel', 'lodge', 'bnb',
      'airbnb', 'booking.com', 'travelstart', 'flight centre', 'sure travel',
      'accommodation', 'guesthouse', 'car hire', 'avis', 'hertz', 'budget car',
      'europcar', 'first car', 'tempest', 'travel agent'
    ]
  },
  {
    code: 'MEDICAL',
    label: 'Medical Expenses',
    keywords: [
      'medical', 'doctor', 'pharmacy', 'clicks', 'dischem', 'hospital',
      'netcare', 'mediclinic', 'life healthcare', 'nhls', 'pathcare',
      'ampath', 'lancet', 'medical aid', 'discovery health', 'bonitas',
      'gems', 'medihelp', 'momentum health', 'fedhealth', 'bestmed',
      'prescription', 'medication', 'script', 'specialist', 'dentist',
      'optometrist', 'physiotherapy', 'occupational health'
    ]
  },
  {
    code: 'SECURITY',
    label: 'Security Services',
    keywords: [
      'security', 'adt', 'fidelity', 'chubb', 'g4s', 'css tactical',
      'armed response', 'alarm', 'cctv', 'surveillance', 'access control',
      'guard', 'patrol', 'monitoring'
    ]
  },
  {
    code: 'CLEANING',
    label: 'Cleaning Services',
    keywords: [
      'cleaning', 'cleaner', 'domestic', 'janitorial', 'hygiene',
      'bidvest steiner', 'rentokil', 'initial', 'sanitary', 'waste management',
      'refuse collection'
    ]
  },
  {
    code: 'IT_EQUIPMENT',
    label: 'IT Equipment & Hardware',
    keywords: [
      'computer', 'laptop', 'desktop', 'server', 'monitor', 'keyboard',
      'mouse', 'hard drive', 'ssd', 'ram', 'memory', 'incredible connection',
      'takealot tech', 'evetech', 'wootware', 'rectron', 'mustek',
      'dell', 'hp', 'lenovo', 'apple mac', 'network', 'router', 'switch'
    ]
  },
  {
    code: 'FURNITURE',
    label: 'Furniture & Fittings',
    keywords: [
      'furniture', 'desk', 'chair', 'cabinet', 'shelf', 'table',
      'mr price home', 'home', '@home', 'coricraft', 'weylandts',
      'furniture city', 'lewis', 'russells', 'bradlows', 'joshua doore'
    ]
  },
  {
    code: 'VAT_INPUT',
    label: 'VAT Input',
    keywords: []
  },
  {
    code: 'VAT_OUTPUT',
    label: 'VAT Output',
    keywords: []
  },
  {
    code: 'VAT_PAYMENT',
    label: 'VAT Payment to SARS',
    keywords: ['sars vat', 'vat payment', 'vat201', 'efiling vat']
  },
  {
    code: 'PROVISIONAL_TAX',
    label: 'Provisional Tax',
    keywords: [
      'provisional tax', 'itr6', 'sars provisional', 'first provisional',
      'second provisional', 'third provisional', 'top up'
    ]
  },
  {
    code: 'COMPANY_TAX',
    label: 'Company Tax / Income Tax',
    keywords: [
      'company tax', 'corporate tax', 'income tax', 'sars income',
      'itr14', 'assessment', 'tax assessment'
    ]
  },
  {
    code: 'DRAWINGS',
    label: 'Drawings',
    keywords: [
      'drawing', 'owner', 'personal', 'director loan', 'member loan',
      'shareholder', 'distribution'
    ]
  },
  {
    code: 'CAPITAL',
    label: 'Capital Contributions',
    keywords: [
      'capital', 'investment', 'shareholder contribution', 'member contribution',
      'capital injection', 'equity'
    ]
  },
  {
    code: 'LOAN_REPAYMENT',
    label: 'Loan Repayment',
    keywords: [
      'loan', 'finance', 'wesbank', 'mfc', 'nedbank finance', 'absa vehicle',
      'fnb vehicle', 'standard bank finance', 'sasfin', 'bidvest bank',
      'business loan', 'term loan', 'instalment', 'asset finance'
    ]
  },
  {
    code: 'INTEREST_RECEIVED',
    label: 'Interest Received',
    keywords: ['interest credit', 'interest earned', 'interest income', 'savings interest']
  },
  {
    code: 'INTEREST_PAID',
    label: 'Interest Paid',
    keywords: [
      'interest debit', 'interest charged', 'finance charge', 'loan interest',
      'overdraft interest'
    ]
  },
  {
    code: 'REVENUE',
    label: 'Revenue/Income',
    keywords: [
      'payment received', 'deposit', 'eft in', 'credit', 'customer payment',
      'debtor payment', 'invoice payment', 'sales', 'income received'
    ]
  },
  {
    code: 'STOCK_PURCHASES',
    label: 'Stock/Inventory Purchases',
    keywords: [
      'stock', 'inventory', 'merchandise', 'goods', 'product purchase',
      'supplier', 'wholesale', 'makro wholesale', 'cash carry'
    ]
  },
  {
    code: 'CREDITOR_PAYMENT',
    label: 'Creditor/Supplier Payment',
    keywords: ['creditor', 'supplier payment', 'account payment', 'vendor payment']
  },
  {
    code: 'DEBTOR_RECEIPT',
    label: 'Debtor/Customer Receipt',
    keywords: ['debtor', 'customer receipt', 'client payment', 'receivable']
  },
  {
    code: 'REFUND',
    label: 'Refund Received/Given',
    keywords: ['refund', 'reversal', 'credit note', 'return', 'reimburse']
  },
  {
    code: 'DONATION',
    label: 'Donations & CSI',
    keywords: [
      'donation', 'charity', 'ngo', 'npc', 'section 18a', 'csi',
      'corporate social', 'gift', 'contribution'
    ]
  },
  {
    code: 'TRAINING',
    label: 'Training & Education',
    keywords: [
      'training', 'course', 'seminar', 'workshop', 'conference',
      'education', 'cpd', 'continuing professional', 'certification',
      'unisa', 'wits', 'uct', 'stellenbosch', 'up', 'ukzn'
    ]
  },
  {
    code: 'MEMBERSHIP',
    label: 'Memberships & Subscriptions',
    keywords: [
      'membership', 'member fee', 'annual fee', 'registration fee',
      'saica member', 'saipa member', 'cima', 'acca', 'professional body',
      'chamber of commerce', 'business forum'
    ]
  },
  {
    code: 'PENALTIES',
    label: 'Penalties & Fines',
    keywords: [
      'penalty', 'fine', 'late payment', 'admin penalty', 'sars penalty',
      'traffic fine', 'municipal fine', 'interest penalty'
    ]
  },
  {
    code: 'OTHER',
    label: 'Other/Unallocated',
    keywords: []
  }
];

// ─── Text Processing Utilities ───────────────────────────────────────────────

/**
 * Normalize a bank description for consistent pattern matching.
 */
function normalizeDescription(desc) {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')       // Remove special chars except spaces
    .replace(/\s+/g, ' ')               // Normalize spaces
    .replace(/\b(r|zar)?\s*\d+([.,]\d+)?\b/g, '') // Remove amounts
    .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, '')  // Remove dates
    .replace(/\b\d{6,}\b/g, '')         // Remove long reference numbers
    .trim();
}

/**
 * Extract meaningful keywords from a description.
 */
function extractKeywords(desc) {
  const stopWords = ['the', 'and', 'for', 'from', 'with', 'ref', 'reference', 'payment', 'debit', 'order'];
  const normalized = normalizeDescription(desc);
  return normalized
    .split(' ')
    .filter(w => w.length > 2)
    .filter(w => !stopWords.includes(w));
}

/**
 * Suggest allocation category using the keyword-matching pipeline.
 * This is the CORE local intelligence — no external APIs.
 *
 * Pipeline order:
 *   1. Learned rules (company-specific exact match)
 *   2. Learned rules (global exact match)
 *   3. Fuzzy learned rules
 *   4. Predefined keyword matching
 *   5. Amount-based heuristics for ambiguous merchants
 *   6. No match → ask user
 */
function suggestCategoryLocal(description, amount = 0, learnedRules = []) {
  const normalized = normalizeDescription(description);
  const keywords = extractKeywords(description);
  const descLower = description.toLowerCase();

  // Step 1: Check learned rules (exact match)
  for (const rule of learnedRules) {
    if (rule.normalizedPattern === normalized) {
      const cat = ALLOCATION_CATEGORIES.find(c => c.code === rule.category);
      return {
        category: rule.category,
        categoryLabel: cat ? cat.label : rule.category,
        confidence: Math.min(rule.confidence || 0.95, 0.99),
        matchType: 'exact',
        ruleId: rule.id || null,
        reasoning: 'Matched a previously learned pattern'
      };
    }
  }

  // Step 2: Fuzzy match learned rules
  let bestLearnedMatch = null;
  let bestLearnedScore = 0;

  for (const rule of learnedRules) {
    const ruleKeywords = (rule.normalizedPattern || '').split(' ').filter(w => w.length > 2);
    if (ruleKeywords.length === 0) continue;

    const overlap = keywords.filter(k =>
      ruleKeywords.some(rk => rk.includes(k) || k.includes(rk))
    ).length;
    const score = overlap / Math.max(keywords.length, ruleKeywords.length);

    if (score > bestLearnedScore && score > 0.4) {
      bestLearnedScore = score;
      bestLearnedMatch = rule;
    }
  }

  if (bestLearnedMatch && bestLearnedScore > 0.6) {
    const cat = ALLOCATION_CATEGORIES.find(c => c.code === bestLearnedMatch.category);
    return {
      category: bestLearnedMatch.category,
      categoryLabel: cat ? cat.label : bestLearnedMatch.category,
      confidence: bestLearnedScore * (bestLearnedMatch.confidence || 0.8),
      matchType: 'learned',
      ruleId: bestLearnedMatch.id || null,
      reasoning: 'Fuzzy match against a learned rule'
    };
  }

  // Step 3: Predefined keyword matching (the core SA intelligence)
  let bestMatch = null;
  let bestScore = 0;

  for (const cat of ALLOCATION_CATEGORIES) {
    if (cat.keywords.length === 0) continue;

    let score = 0;
    for (const kw of cat.keywords) {
      if (descLower.includes(kw)) {
        // Longer keyword matches score higher (more specific)
        score += kw.split(' ').length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }

  if (bestMatch && bestScore > 0) {
    const confidence = Math.min(0.60 + (bestScore * 0.08), 0.92);
    return {
      category: bestMatch.code,
      categoryLabel: bestMatch.label,
      confidence,
      matchType: 'keyword',
      ruleId: null,
      reasoning: `Matched ${bestScore} keyword(s) for ${bestMatch.label}`
    };
  }

  // Step 4: Amount-based heuristics for common SA merchants
  const merchantLower = (description || '').toLowerCase();

  // Fuel station by amount
  if (['engen', 'shell', 'bp', 'sasol', 'caltex', 'total'].some(m => merchantLower.includes(m))) {
    if (amount >= 500) {
      return {
        category: 'FUEL',
        categoryLabel: 'Fuel & Motor Expenses',
        confidence: 0.90,
        matchType: 'rule_based',
        ruleId: null,
        reasoning: 'Large amount at fuel station — likely fuel purchase'
      };
    } else if (amount > 0 && amount < 50) {
      return {
        category: 'ENTERTAINMENT',
        categoryLabel: 'Entertainment & Meals',
        confidence: 0.80,
        matchType: 'rule_based',
        ruleId: null,
        reasoning: 'Small amount at fuel station — likely convenience store'
      };
    }
  }

  // Step 5: No match
  return {
    category: null,
    categoryLabel: null,
    confidence: 0,
    matchType: 'none',
    ruleId: null,
    reasoning: 'No matching pattern found — SEAN needs your guidance'
  };
}

/**
 * Get top alternative suggestions (for when the primary match is low confidence).
 */
function getAlternativeSuggestions(description, excludeCode = null) {
  const descLower = description.toLowerCase();
  const scores = [];

  for (const cat of ALLOCATION_CATEGORIES) {
    if (cat.code === excludeCode || cat.keywords.length === 0) continue;

    let score = 0;
    for (const kw of cat.keywords) {
      if (descLower.includes(kw)) {
        score += kw.split(' ').length;
      }
    }

    if (score > 0) {
      scores.push({
        code: cat.code,
        label: cat.label,
        confidence: Math.min(0.50 + (score * 0.08), 0.85)
      });
    }
  }

  return scores
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

module.exports = {
  ALLOCATION_CATEGORIES,
  normalizeDescription,
  extractKeywords,
  suggestCategoryLocal,
  getAlternativeSuggestions
};
