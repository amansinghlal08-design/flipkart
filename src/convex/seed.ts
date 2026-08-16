import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Idempotent seed: populates the catalogue (categories, products, sample
 * reviews) on first run. The storefront calls this once on mount, so a fresh
 * deployment is never empty.
 */

const CATEGORIES: { slug: string; name: string; icon: string }[] = [
  { slug: "mobile", name: "Mobile Phones", icon: "Smartphone" },
  { slug: "laptop", name: "Laptops", icon: "Laptop" },
  { slug: "audio", name: "Audio", icon: "Headphones" },
  { slug: "wearables", name: "Wearables", icon: "Watch" },
  { slug: "footwear", name: "Footwear", icon: "Footprints" },
  { slug: "apparel", name: "Apparel", icon: "Shirt" },
  { slug: "home", name: "Home & Decor", icon: "Lamp" },
  { slug: "kitchen", name: "Kitchen", icon: "ChefHat" },
  { slug: "beauty", name: "Beauty", icon: "Sparkles" },
  { slug: "toys", name: "Toys & Games", icon: "Gamepad2" },
  { slug: "books", name: "Books", icon: "BookOpen" },
  { slug: "grocery", name: "Grocery", icon: "ShoppingBasket" },
];

type SeedProduct = {
  name: string;
  brand: string;
  category: string;
  description: string;
  highlights: string[];
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  stock: number;
  badges: string[];
  tags: string[];
};

const PRODUCTS: SeedProduct[] = [
  // ---- mobile ----
  {
    name: "Nova X5",
    brand: "Northstar",
    category: "mobile",
    description:
      "A quietly powerful everyday phone with a bright AMOLED display and a battery that outlasts your day.",
    highlights: [
      "6.7\" AMOLED display, 120 Hz",
      "108 MP triple camera",
      "5000 mAh battery, 33 W fast charge",
      "5G, 8 GB RAM / 128 GB storage",
    ],
    price: 21999,
    mrp: 27999,
    rating: 4.5,
    ratingCount: 3240,
    stock: 14,
    badges: ["Best Seller"],
    tags: ["5g", "camera", "amoled"],
  },
  {
    name: "PixCore M3",
    brand: "Pixelworks",
    category: "mobile",
    description:
      "All the essentials done right — a crisp display, dependable cameras and clean software updates.",
    highlights: [
      "6.5\" FHD+ display",
      "64 MP dual camera",
      "5000 mAh battery",
      "4 GB RAM / 64 GB storage",
    ],
    price: 12499,
    mrp: 15999,
    rating: 4.2,
    ratingCount: 1875,
    stock: 9,
    badges: [],
    tags: ["budget", "camera"],
  },
  {
    name: "Orion Fold 2",
    brand: "Orion",
    category: "mobile",
    description:
      "A refined foldable that opens into a compact tablet — for those who like their devices as minimal as their desks.",
    highlights: [
      "7.6\" foldable AMOLED, 120 Hz",
      "12 GB RAM / 256 GB storage",
      "50 MP main camera",
      "IPX8 water resistance",
    ],
    price: 89999,
    mrp: 109999,
    rating: 4.6,
    ratingCount: 640,
    stock: 3,
    badges: ["Premium"],
    tags: ["foldable", "flagship"],
  },

  // ---- laptop ----
  {
    name: "AeroBook Air 14",
    brand: "Aerova",
    category: "laptop",
    description:
      "Featherlight aluminium body, all-day battery and a display sharp enough for serious work.",
    highlights: [
      "14\" 2.8K display",
      "16 GB RAM / 512 GB SSD",
      "Up to 12 h battery",
      "1.2 kg, aluminium unibody",
    ],
    price: 62999,
    mrp: 79999,
    rating: 4.7,
    ratingCount: 952,
    stock: 7,
    badges: ["Best Seller"],
    tags: ["ultrabook", "work"],
  },
  {
    name: "TitanBook Pro 16",
    brand: "Titanium",
    category: "laptop",
    description:
      "A workstation-grade machine for creators — plenty of memory, a colour-accurate screen and serious graphics.",
    highlights: [
      "16\" 3.2K display, 100% DCI-P3",
      "32 GB RAM / 1 TB SSD",
      "Dedicated graphics",
      "Backlit keyboard, Thunderbolt",
    ],
    price: 104999,
    mrp: 129999,
    rating: 4.5,
    ratingCount: 418,
    stock: 2,
    badges: ["Premium"],
    tags: ["creator", "performance"],
  },
  {
    name: "SwiftBook Go",
    brand: "Swiftline",
    category: "laptop",
    description:
      "The dependable student companion — light to carry, fast to boot, easy on the wallet.",
    highlights: [
      "13.3\" FHD display",
      "8 GB RAM / 256 GB SSD",
      "8 h battery",
      "1.2 kg",
    ],
    price: 39999,
    mrp: 49999,
    rating: 4.1,
    ratingCount: 2310,
    stock: 25,
    badges: ["Trending"],
    tags: ["student", "budget"],
  },

  // ---- audio ----
  {
    name: "SonicBuds Pro",
    brand: "Sonance",
    category: "audio",
    description:
      "True wireless earbuds with active noise cancellation — your commute, minus the noise.",
    highlights: [
      "Active noise cancellation",
      "30 h total playtime",
      "Bluetooth 5.3, low latency",
      "IPX4 sweat resistant",
    ],
    price: 3999,
    mrp: 7999,
    rating: 4.6,
    ratingCount: 8420,
    stock: 42,
    badges: ["Best Seller"],
    tags: ["anc", "tws", "wireless"],
  },
  {
    name: "WavePlay Max",
    brand: "Sonance",
    category: "audio",
    description:
      "Over-ear headphones tuned for depth — warm lows, clear highs, and comfort for long sessions.",
    highlights: [
      "40 mm drivers, deep bass",
      "40 h battery life",
      "Plush memory-foam pads",
      "Wired + wireless modes",
    ],
    price: 6499,
    mrp: 9999,
    rating: 4.4,
    ratingCount: 1210,
    stock: 18,
    badges: [],
    tags: ["over-ear", "wireless"],
  },
  {
    name: "EchoBeat Sport",
    brand: "PulseCore",
    category: "audio",
    description:
      "Sweat-proof buds with secure ear hooks — built for the gym, priced for everyone.",
    highlights: [
      "IPX5 sweat proof",
      "12 h playtime",
      "Secure ear hooks",
      "Bluetooth 5.1",
    ],
    price: 1799,
    mrp: 3499,
    rating: 4.0,
    ratingCount: 5432,
    stock: 60,
    badges: [],
    tags: ["sport", "budget"],
  },

  // ---- wearables ----
  {
    name: "PulseFit Active",
    brand: "PulseCore",
    category: "wearables",
    description:
      "A discreet fitness band that tracks heart, sleep and steps — and stays charged for a week and a half.",
    highlights: [
      "Heart-rate & SpO2 tracking",
      "Built-in GPS",
      "10-day battery",
      "5 ATM water resistant",
    ],
    price: 2499,
    mrp: 4999,
    rating: 4.3,
    ratingCount: 21042,
    stock: 55,
    badges: ["Best Seller"],
    tags: ["fitness", "band"],
  },
  {
    name: "TimeMark Classic",
    brand: "TimeMark",
    category: "wearables",
    description:
      "A quiet, minimal dress watch — clean dial, sapphire glass and a genuine leather strap.",
    highlights: [
      "Japanese quartz movement",
      "Sapphire glass",
      "Genuine leather strap",
      "5 ATM water resistant",
    ],
    price: 7999,
    mrp: 12999,
    rating: 4.5,
    ratingCount: 322,
    stock: 8,
    badges: ["New"],
    tags: ["watch", "minimal"],
  },
  {
    name: "ZenBand S2",
    brand: "Zenith",
    category: "wearables",
    description:
      "Sleep and activity tracking in a featherweight band you'll forget you're wearing.",
    highlights: [
      "Sleep-stage tracking",
      "7-day battery",
      "Stress monitoring",
      "1.1\" AMOLED display",
    ],
    price: 1499,
    mrp: 2999,
    rating: 3.9,
    ratingCount: 9812,
    stock: 70,
    badges: [],
    tags: ["band", "sleep"],
  },

  // ---- footwear ----
  {
    name: "StrideRunner",
    brand: "Stride",
    category: "footwear",
    description:
      "Lightweight running shoes with a responsive cushioned sole — made for daily miles.",
    highlights: [
      "Breathable engineered mesh",
      "Responsive EVA cushioning",
      "~220 g per shoe",
      "Reflective accents",
    ],
    price: 2999,
    mrp: 5999,
    rating: 4.4,
    ratingCount: 3218,
    stock: 35,
    badges: ["Trending"],
    tags: ["running", "sneakers"],
  },
  {
    name: "UrbanStep Loafers",
    brand: "Metro",
    category: "footwear",
    description:
      "Clean, hand-finished loafers that go from office to evening without a second thought.",
    highlights: [
      "Genuine leather upper",
      "Cushioned insole",
      "Slip-resistant sole",
      "Hand-finished",
    ],
    price: 1899,
    mrp: 3499,
    rating: 4.2,
    ratingCount: 764,
    stock: 12,
    badges: [],
    tags: ["formal", "leather"],
  },
  {
    name: "TrailHike Boots",
    brand: "Summit",
    category: "footwear",
    description:
      "Waterproof, grippy boots for monsoon trails and weekend getaways.",
    highlights: [
      "Waterproof membrane",
      "Aggressive lug outsole",
      "Ankle support",
      "All-terrain grip",
    ],
    price: 4499,
    mrp: 7999,
    rating: 4.6,
    ratingCount: 548,
    stock: 6,
    badges: [],
    tags: ["outdoor", "boots"],
  },

  // ---- apparel ----
  {
    name: "Essential Tee — Pack of 3",
    brand: "Base",
    category: "apparel",
    description:
      "The everyday tee in three quiet colours — 100% combed cotton, pre-shrunk, made to last.",
    highlights: [
      "100% combed cotton",
      "Pre-shrunk, no-fade colour",
      "Regular fit",
      "Pack of 3",
    ],
    price: 799,
    mrp: 1599,
    rating: 4.3,
    ratingCount: 12034,
    stock: 120,
    badges: ["Best Seller"],
    tags: ["t-shirt", "basics"],
  },
  {
    name: "CloudKnit Sweater",
    brand: "Loom",
    category: "apparel",
    description:
      "A soft merino-blend knit with clean ribbing — warmth without the bulk.",
    highlights: [
      "Merino-wool blend",
      "Ribbed cuffs & hem",
      "Warm without bulk",
      "One size fits most",
    ],
    price: 1299,
    mrp: 2599,
    rating: 4.4,
    ratingCount: 892,
    stock: 30,
    badges: [],
    tags: ["knitwear", "winter"],
  },
  {
    name: "Sahara Linen Shirt",
    brand: "Metro",
    category: "apparel",
    description:
      "Breathable pure linen in a relaxed cut — the shirt for hot afternoons.",
    highlights: [
      "100% breathable linen",
      "Relaxed fit",
      "Natural buttons",
      "Wrinkle-friendly weave",
    ],
    price: 1599,
    mrp: 2999,
    rating: 4.1,
    ratingCount: 1512,
    stock: 22,
    badges: [],
    tags: ["linen", "summer"],
  },

  // ---- home ----
  {
    name: "Lumen Desk Lamp",
    brand: "Forma",
    category: "home",
    description:
      "A dimmable task lamp with warm, even light and a base that stays out of your way.",
    highlights: [
      "Touch dimming, 3 levels",
      "Warm white, 4000 K",
      "Articulating arm",
      "Steel & matte finish",
    ],
    price: 2299,
    mrp: 3999,
    rating: 4.5,
    ratingCount: 428,
    stock: 15,
    badges: ["New"],
    tags: ["lighting", "desk"],
  },
  {
    name: "Nest Cushion Set",
    brand: "Forma",
    category: "home",
    description:
      "Two soft cotton cushions in a quiet, woven texture — instant calm for any sofa.",
    highlights: [
      "100% cotton covers",
      "Set of 2, 45 x 45 cm",
      "Hidden zipper",
      "Machine washable",
    ],
    price: 999,
    mrp: 1899,
    rating: 4.2,
    ratingCount: 2144,
    stock: 40,
    badges: [],
    tags: ["decor", "cushion"],
  },
  {
    name: "AeroCane Chair",
    brand: "Forma",
    category: "home",
    description:
      "Hand-woven cane on a solid oak frame — a sculptural seat that wears beautifully.",
    highlights: [
      "Hand-woven cane seat",
      "Solid oak frame",
      "Removable cushion",
      "Made to order",
    ],
    price: 8499,
    mrp: 12999,
    rating: 4.4,
    ratingCount: 132,
    stock: 4,
    badges: ["Premium"],
    tags: ["furniture", "chair"],
  },

  // ---- kitchen ----
  {
    name: "KettleOne",
    brand: "ChefLine",
    category: "kitchen",
    description:
      "A quiet 1.5 L kettle with auto shut-off and a matte finish that hides fingerprints.",
    highlights: [
      "1.5 L capacity",
      "Auto shut-off, boil dry guard",
      "Matte stainless body",
      "1500 W, fast boil",
    ],
    price: 1499,
    mrp: 2799,
    rating: 4.3,
    ratingCount: 5340,
    stock: 50,
    badges: [],
    tags: ["kettle", "appliance"],
  },
  {
    name: "BrewMaster Grinder",
    brand: "ChefLine",
    category: "kitchen",
    description:
      "A stainless burr grinder for coffee that tastes like it cost three times more.",
    highlights: [
      "Stainless conical burrs",
      "18 grind settings",
      "250 g bean hopper",
      "Cordless, USB-C",
    ],
    price: 2799,
    mrp: 4499,
    rating: 4.5,
    ratingCount: 684,
    stock: 9,
    badges: [],
    tags: ["coffee", "grinder"],
  },
  {
    name: "Panora Cookware Set",
    brand: "ChefLine",
    category: "kitchen",
    description:
      "Five non-stick pieces that stack neatly and clean up in seconds.",
    highlights: [
      "5-piece non-stick set",
      "PTFE-free coating",
      "Induction compatible",
      "Stackable design",
    ],
    price: 3999,
    mrp: 7499,
    rating: 4.6,
    ratingCount: 2412,
    stock: 18,
    badges: ["Best Seller"],
    tags: ["cookware", "set"],
  },

  // ---- beauty ----
  {
    name: "GlowDew Serum",
    brand: "Aria",
    category: "beauty",
    description:
      "A featherlight vitamin-C serum that fades dullness and brightens over time.",
    highlights: [
      "10% vitamin C + hyaluronic acid",
      "Dermatologically tested",
      "Vegan, cruelty-free",
      "30 ml, daily use",
    ],
    price: 899,
    mrp: 1799,
    rating: 4.4,
    ratingCount: 8922,
    stock: 65,
    badges: ["Trending"],
    tags: ["serum", "skincare"],
  },
  {
    name: "PureLeaf Cleanser",
    brand: "Aria",
    category: "beauty",
    description:
      "A gentle botanical cleanser that removes the day without stripping your skin.",
    highlights: [
      "Green tea + aloe",
      "pH balanced",
      "Sulphate-free",
      "150 ml",
    ],
    price: 549,
    mrp: 999,
    rating: 4.2,
    ratingCount: 4210,
    stock: 80,
    badges: [],
    tags: ["cleanser", "skincare"],
  },
  {
    name: "SatinLip Kit",
    brand: "Aria",
    category: "beauty",
    description:
      "Three buildable satin shades in one slim case — your whole lip wardrobe.",
    highlights: [
      "3 satin shades",
      "Moisturising formula",
      "Transfer-resistant",
      "Vegan",
    ],
    price: 699,
    mrp: 1299,
    rating: 4.0,
    ratingCount: 1512,
    stock: 36,
    badges: [],
    tags: ["lipstick", "makeup"],
  },

  // ---- toys ----
  {
    name: "BlockSet 500",
    brand: "Playlab",
    category: "toys",
    description:
      "500 interlocking blocks in a natural palette — the only toy your kid will need this year.",
    highlights: [
      "500 pieces",
      "Non-toxic, BPA-free",
      "Ideal for ages 4+",
      "Storage tub included",
    ],
    price: 1299,
    mrp: 2499,
    rating: 4.7,
    ratingCount: 3120,
    stock: 45,
    badges: ["Best Seller"],
    tags: ["blocks", "kids"],
  },
  {
    name: "RoboKit Starter",
    brand: "Playlab",
    category: "toys",
    description:
      "Build a robot, then code it — a gentle on-ramp to electronics for curious minds.",
    highlights: [
      "Build & code in one kit",
      "Drag-and-drop coding",
      "No soldering required",
      "Ages 8+",
    ],
    price: 2499,
    mrp: 4499,
    rating: 4.5,
    ratingCount: 826,
    stock: 20,
    badges: ["New"],
    tags: ["stem", "robot"],
  },
  {
    name: "PuzzleVerse 1000",
    brand: "Playlab",
    category: "toys",
    description:
      "A 1000-piece puzzle in a muted palette — quiet evenings, sorted.",
    highlights: [
      "1000 pieces",
      "Matte finish, glare-free",
      "60 x 90 cm when complete",
      "Premium box",
    ],
    price: 599,
    mrp: 1199,
    rating: 4.3,
    ratingCount: 2614,
    stock: 60,
    badges: [],
    tags: ["puzzle", "adults"],
  },

  // ---- books ----
  {
    name: "The Quiet Code",
    brand: "Pine Press",
    category: "books",
    description:
      "A novel about software, silence and second chances — shortlisted for the fiction prize.",
    highlights: [
      "Hardcover, 320 pages",
      "Fiction",
      "Shortlisted, Fiction Prize",
      "Signed first edition",
    ],
    price: 499,
    mrp: 799,
    rating: 4.6,
    ratingCount: 4312,
    stock: 90,
    badges: ["Best Seller"],
    tags: ["fiction", "hardcover"],
  },
  {
    name: "Minimal Living",
    brand: "Pine Press",
    category: "books",
    description:
      "A practical guide to owning less and living more — room by room.",
    highlights: [
      "Paperback, 240 pages",
      "Self-help / lifestyle",
      "Room-by-room guide",
      "Includes checklists",
    ],
    price: 449,
    mrp: 699,
    rating: 4.4,
    ratingCount: 1918,
    stock: 55,
    badges: [],
    tags: ["lifestyle", "minimalism"],
  },
  {
    name: "Deep Focus",
    brand: "Pine Press",
    category: "books",
    description:
      "The modern guide to concentration in an age of interruption.",
    highlights: [
      "Paperback, 288 pages",
      "Productivity",
      "Backed by research",
      "Readable in a weekend",
    ],
    price: 399,
    mrp: 599,
    rating: 4.5,
    ratingCount: 5610,
    stock: 70,
    badges: [],
    tags: ["productivity", "focus"],
  },

  // ---- grocery ----
  {
    name: "Organic Basmati Rice — 5 kg",
    brand: "Fieldstone",
    category: "grocery",
    description:
      "Aged, single-origin basmati from organic farms — long grains, distinct aroma.",
    highlights: [
      "Aged 12+ months",
      "Certified organic",
      "5 kg bag",
      "Single origin, Punjab",
    ],
    price: 649,
    mrp: 899,
    rating: 4.5,
    ratingCount: 2812,
    stock: 200,
    badges: [],
    tags: ["rice", "organic"],
  },
  {
    name: "ColdBrew Beans — 1 kg",
    brand: "Fieldstone",
    category: "grocery",
    description:
      "Single-origin arabica, roasted in small batches — smooth enough to drink black.",
    highlights: [
      "100% arabica",
      "Roasted in small batches",
      "1 kg whole beans",
      "Notes of chocolate & caramel",
    ],
    price: 899,
    mrp: 1299,
    rating: 4.7,
    ratingCount: 1612,
    stock: 34,
    badges: ["Trending"],
    tags: ["coffee", "beans"],
  },
  {
    name: "Wild Honey Jar — 500 g",
    brand: "Fieldstone",
    category: "grocery",
    description:
      "Raw, unfiltered honey from single-source hives — nothing added, nothing taken out.",
    highlights: [
      "Raw & unfiltered",
      "Single-source hives",
      "500 g glass jar",
      "No additives",
    ],
    price: 549,
    mrp: 799,
    rating: 4.6,
    ratingCount: 3418,
    stock: 88,
    badges: [],
    tags: ["honey", "organic"],
  },
];

const REVIEW_COMMENTS = [
  "Exactly as described. Build quality feels far above the price.",
  "Fast delivery and well packaged. Very happy with the purchase.",
  "Been using it for two weeks — quietly impressed.",
  "Does the job, no complaints. Would buy again.",
  "Looks premium in person. Photos don't do it justice.",
  "Great value at this price point. Recommended.",
];

const REVIEW_TITLES = [
  "Solid purchase",
  "Exceeded expectations",
  "Good value",
  "Happy with it",
  "Worth every rupee",
  "As advertised",
];

export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("products").first();
    if (existing !== null) {
      return { seeded: false, products: 0 };
    }

    const now = Date.now();

    for (const [index, category] of CATEGORIES.entries()) {
      await ctx.db.insert("categories", {
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        order: index,
      });
    }

    for (const [index, product] of PRODUCTS.entries()) {
      const productId = await ctx.db.insert("products", {
        ...product,
        createdAt: now - index * 1000,
      });

      // three deterministic sample reviews per product
      for (let r = 0; r < 3; r++) {
        const seed = (index * 7 + r * 13) % REVIEW_COMMENTS.length;
        const rating = Math.min(
          5,
          Math.max(3, Math.round(product.rating + (r - 1) * 0.4)),
        );
        await ctx.db.insert("reviews", {
          productId,
          userId: undefined,
          userName: ["Aarav M.", "Priya S.", "Rohan K."][r],
          rating,
          title: REVIEW_TITLES[(seed + r) % REVIEW_TITLES.length],
          comment: REVIEW_COMMENTS[(seed + r) % REVIEW_COMMENTS.length],
          createdAt: now - (r + 1) * 86400000,
        });
      }
    }

    return { seeded: true, products: PRODUCTS.length };
  },
});
