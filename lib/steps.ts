/**
 * STEP 2 DATA — "Cook It the Lake Flavour Way".
 * Single source of truth for the cooking-steps section.
 *
 * EDITING GUIDE (no code knowledge needed):
 * - Change any title / description / time label by editing the text
 *   between the quotes. Keep the commas and quotes as they are.
 * - "fit": "cover" fills the card and crops the photo; "contain" shows
 *   the whole photo with dark bars around it. Use "contain" for tall
 *   (portrait) photos so nothing important is cropped away.
 * - "objectPosition" moves the crop focus ("50% 50%" is the centre,
 *   "50% 30%" shows the upper part of the photo).
 * - Images live in /public/images/steps as step-01 .. step-11
 *   (desktop), -800 (mobile) and -tiny (blurred placeholder) WebP.
 */

/** One cooking step, exactly as shown on the step card. */
export interface CookingStep {
  /** Stable id — also the on-screen step number (01 .. 11). */
  id: number;
  /** Serif heading on the glass panel, e.g. "Heat the Oil". */
  title: string;
  /** Body text on the glass panel. */
  description: string;
  /** Short label in the time chip, e.g. "1 min". */
  timeLabel: string;
  /** Desktop image (about 1600px WebP). */
  src: string;
  /** Mobile image (800px WebP). */
  srcMobile: string;
  /** ~24px blurred placeholder — shown instantly while loading and
   *  scaled up behind the card as the ambient background. */
  srcTiny: string;
  /** Alt text for screen readers. */
  alt: string;
  /** How the photo sits in the 16:9 card / 4:5 mobile card. */
  fit: "cover" | "contain";
  /** Crop focus when fit is "cover". */
  objectPosition: string;
}

/** Section heading shown above the step viewer. */
export const STEPS_HEADING = "Cook It the Lake Flavour Way";

/** Section subheading shown under the heading. */
export const STEPS_SUBHEADING =
  "Eleven simple steps, about 20 minutes, from pan to plate.";

export const COOKING_STEPS: CookingStep[] = [
  {
    id: 1,
    title: "Heat the Oil",
    description:
      "Pour 2 tablespoons of cooking oil into a heavy skillet over medium heat. Wait until it shimmers.",
    timeLabel: "1 min",
    src: "/images/steps/step-01.webp",
    srcMobile: "/images/steps/step-01-800.webp",
    srcTiny: "/images/steps/step-01-tiny.webp",
    alt: "Golden cooking oil pouring from a bottle into a black skillet on a dark stove",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 2,
    title: "Sauté the Onions",
    description:
      "Add 1 chopped red onion. Stir until soft and translucent.",
    timeLabel: "3 min",
    src: "/images/steps/step-02.webp",
    srcMobile: "/images/steps/step-02-800.webp",
    srcTiny: "/images/steps/step-02-tiny.webp",
    alt: "Chopped red onions on a wooden board above a skillet with onions sautéing",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 3,
    title: "Add the Tomatoes",
    description:
      "Stir in 2 ripe diced tomatoes. Cook until soft and the sauce turns rich and jammy.",
    timeLabel: "5 min",
    src: "/images/steps/step-03.webp",
    srcMobile: "/images/steps/step-03-800.webp",
    srcTiny: "/images/steps/step-03-tiny.webp",
    alt: "Diced tomatoes falling from a board into a sizzling skillet with onions",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 4,
    title: "Season It",
    description:
      "Sprinkle in your spices (curry powder or masala, a pinch of salt, a little black pepper) and stir to wake up the aroma.",
    timeLabel: "1 min",
    src: "/images/steps/step-04.webp",
    srcMobile: "/images/steps/step-04-800.webp",
    srcTiny: "/images/steps/step-04-tiny.webp",
    alt: "A cascade of spices and seasoning falling over sizzling tomatoes in a skillet",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 5,
    title: "Add the Omena",
    description:
      "Pour in 1 cup (about 100 g) of Lake Flavour Fried Omena. It is already crispy, so fold it gently into the sauce.",
    timeLabel: "2 min",
    src: "/images/steps/step-05.webp",
    srcMobile: "/images/steps/step-05-800.webp",
    srcTiny: "/images/steps/step-05-tiny.webp",
    alt: "Crispy fried omena cascading from a bowl into a rich tomato sauce in a skillet",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 6,
    title: "Pour in Coconut Milk",
    description:
      "Add half a cup of coconut milk for a creamy finish. Skip it for a drier, crispier dish.",
    timeLabel: "2 min (optional)",
    src: "/images/steps/step-06.webp",
    srcMobile: "/images/steps/step-06-800.webp",
    srcTiny: "/images/steps/step-06-tiny.webp",
    alt: "Creamy coconut milk pouring from a glass jar into an omena skillet",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 7,
    title: "Simmer and Stir",
    description:
      "Lower the heat and stir gently so every fish picks up the sauce.",
    timeLabel: "3 min",
    src: "/images/steps/step-07.webp",
    srcMobile: "/images/steps/step-07-800.webp",
    srcTiny: "/images/steps/step-07-tiny.webp",
    alt: "Wooden spoon stirring a simmering omena and tomato stir-fry with steam rising",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 8,
    title: "Let It Thicken",
    description:
      "Keep stirring until the sauce clings to the fish and the aroma turns rich.",
    timeLabel: "2 min",
    src: "/images/steps/step-08.webp",
    srcMobile: "/images/steps/step-08-800.webp",
    srcTiny: "/images/steps/step-08-tiny.webp",
    alt: "Sizzling omena in a thick spicy tomato and herb sauce clinging to the fish",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 9,
    title: "Finish with Fresh Coriander",
    description:
      "Scatter chopped coriander just before taking the pan off the heat.",
    timeLabel: "30 sec",
    src: "/images/steps/step-09.webp",
    srcMobile: "/images/steps/step-09-800.webp",
    srcTiny: "/images/steps/step-09-tiny.webp",
    alt: "Fresh coriander leaves being scattered over a steaming herbed fish skillet",
    fit: "cover",
    objectPosition: "50% 50%",
  },
  {
    id: 10,
    title: "Taste and Adjust",
    description: "Check the salt and spice. Add what you like, then it is ready.",
    timeLabel: "1 min",
    src: "/images/steps/step-10.webp",
    srcMobile: "/images/steps/step-10-800.webp",
    srcTiny: "/images/steps/step-10-tiny.webp",
    alt: "A wooden spoon lifting omena stir-fry from a black skillet for a taste",
    // Portrait photo — "contain" keeps the whole scene visible over the
    // ambient background instead of cropping it harshly.
    fit: "contain",
    objectPosition: "50% 50%",
  },
  {
    id: 11,
    title: "Serve Hot with Ugali",
    description:
      "Plate it beside fresh, soft ugali and enjoy while it steams.",
    timeLabel: "Ready",
    src: "/images/steps/step-11.webp",
    srcMobile: "/images/steps/step-11-800.webp",
    srcTiny: "/images/steps/step-11-tiny.webp",
    alt: "Omena stew on a white plate beside fresh slices of ugali, ready to serve",
    // Portrait photo — same contain treatment as step 10.
    fit: "contain",
    objectPosition: "50% 50%",
  },
];
