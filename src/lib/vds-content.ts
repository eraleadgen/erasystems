/**
 * Copy for the VDS Mobile marketing site. Content only, no logic, so the
 * tenant site stays a presentation layer over the live service catalog.
 */

export const VDS_PHONE_DISPLAY = "(470) 944-6485";
export const VDS_PHONE_E164 = "+14709446485";
export const VDS_EMAIL = "valetdetailingservice@gmail.com";

export const VDS_STATS: { value: string; label: string }[] = [
  { value: "500+", label: "Vehicles detailed" },
  { value: "5.0", label: "Google rating" },
  { value: "4+", label: "Years in Atlanta" },
  { value: "100%", label: "Satisfaction guaranteed" },
];

export const VDS_REVIEWS: { quote: string; name: string }[] = [
  {
    quote:
      "I was a little skeptical of the outcome. I used a couple of other companies since moving to Georgia in 2019 and was disappointed. I owned a detail company in the 1980s so I knew what to expect. I am extremely happy and grateful for the outstanding cleaning you provided. If anyone wants a perfect detail, at a great price, provided by friendly and masterful craftsmen, do not hesitate to contact VDS Mobile.",
    name: "Jess Naylor",
  },
  {
    quote:
      "VDS Mobile does an amazing job. I highly recommend Shane, he will exceed your expectations every time.",
    name: "John Redmond",
  },
  {
    quote:
      "Noah Grove did a fabulous job on my car! Looks better than it did when I bought new. Best detail I've ever had on any car I've owned.",
    name: "Alice Findley",
  },
  {
    quote:
      "These guys are great! Showed up on time, ready to get down to business on my Corvette. Focused on every inch of \u201cMy Baby\u201d. The car turned out amazing. Great communication and customer service.",
    name: "Milton Hamilton",
  },
  {
    quote:
      "The VDS guys gave my 2024 Corvette an amazing wash and wax. I didn't know the car was even capable of looking as good as it did. Clean, professional, punctual and affordable.",
    name: "Dylan Kuster",
  },
];

export const VDS_PILLARS: { code: string; title: string; sub: string; stack: string[] }[] = [
  {
    code: "FULL_DETAIL",
    title: "Full Detail",
    sub: "Interior and exterior restoration",
    stack: [
      "Interior and exterior restoration",
      "Odor and stain removal",
      "Professional products",
      "Ceramic sealant",
    ],
  },
  {
    code: "CERAMIC_COATING",
    title: "Ceramic Coatings",
    sub: "Long term paint protection",
    stack: [
      "2 to 7 year coatings",
      "Professional grade coatings",
      "Hydrophobic surface protection",
      "UV and chemical resistance",
    ],
  },
  {
    code: "PAINT_CORRECTION",
    title: "Paint Correction",
    sub: "Swirl and scratch removal",
    stack: [
      "Swirl mark elimination",
      "Scratch and buffer trail removal",
      "Flawless paint quality",
      "Coating recommended",
    ],
  },
];

export const VDS_GOLD = {
  priceSedan: "$250",
  priceTruck: "$300",
  retail: "$700+",
  exterior: [
    "Hand wash, rims and wheel barrels",
    "Hand wash, all exterior panels",
    "Door jambs, full clean and dress",
    "One month ceramic sealant applied",
    "Exterior glass cleaned",
    "Tires dressed and shined",
  ],
  interior: [
    "Steam clean, all surfaces and crevices",
    "Deep vacuum, every inch of interior",
    "Interior windows cleaned",
    "Dashboard, all surfaces wiped",
    "Door panels, full wipe down",
    "Seats, every surface and stitch",
    "Floors and mats deep cleaned",
  ],
  steps: [
    { n: "01", title: "Create account", body: "Sign up online, add your vehicles and set your preferences." },
    { n: "02", title: "Schedule", body: "Book exterior details any time, as many as you need each month." },
    { n: "03", title: "We come to you", body: "Our team arrives at your location with professional equipment." },
    { n: "04", title: "Stay perfect", body: "Your vehicle stays appointment ready, month after month." },
  ],
};

export const VDS_FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: "Booking and scheduling",
    items: [
      {
        q: "Do I need to be home during the service?",
        a: "No. As long as we have access to the vehicle and a water and power source where required, you can go about your day. We text you when we arrive and when we finish.",
      },
      {
        q: "How long does a detail usually take?",
        a: "An exterior detail runs about 90 minutes, an interior detail about two hours and a full detail around two and a half hours, depending on size and condition.",
      },
      {
        q: "What is your cancellation policy?",
        a: "Reschedule or cancel any time up to 24 hours before your appointment at no charge. Text us and we will find a new slot.",
      },
    ],
  },
  {
    group: "Our services",
    items: [
      {
        q: "Is mobile detailing safe for high end vehicles?",
        a: "Yes. We use paint safe techniques, pH neutral chemicals and dedicated wash media, and we work on luxury and performance vehicles every week.",
      },
      {
        q: "What is the difference between a full detail and VDS Gold?",
        a: "A full detail is a one time restoration. VDS Gold is a monthly membership that keeps the vehicle in that condition with unlimited exterior details and one interior detail each month.",
      },
    ],
  },
  {
    group: "Payment and policy",
    items: [
      {
        q: "What forms of payment do you accept?",
        a: "Card, Apple Pay, Zelle and cash. Payment is taken once the work is complete and you have seen the vehicle.",
      },
      {
        q: "What if I am not satisfied?",
        a: "Tell us before we leave and we will correct it on the spot. Every service is backed by our satisfaction guarantee.",
      },
    ],
  },
];

export const VEHICLE_CONDITIONS = [
  { id: "light", label: "Light wear", note: "Base rate", multiplier: 1 },
  { id: "moderate", label: "Moderate wear", note: "+20%", multiplier: 1.2 },
  { id: "heavy", label: "Heavy wear", note: "+40%", multiplier: 1.4 },
] as const;

export type ConditionId = (typeof VEHICLE_CONDITIONS)[number]["id"];
