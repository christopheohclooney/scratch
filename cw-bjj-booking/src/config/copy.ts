/*
  All visible text lives here. Trials are paid, so never use the word "free".
*/

export const copy = {
  heading: {
    line1: "Book your first class",
    line2: "Pick your programme and choose a time.",
  },

  step1: {
    eyebrow: "Step 1",
    question: "Who's training?",
    options: { adult: "Adult", child: "Child" },
  },

  step2Adult: {
    eyebrow: "Step 2",
    question: "Choose your programme",
    helpLink: "Which programme is right for me?",
  },

  step2Child: {
    eyebrow: "Step 2",
    question: "Choose their age group",
  },

  step3: {
    eyebrow: "Step 3",
    question: "Book your class",
    placeholder: "Class times appear here once you've chosen a programme.",
    paymentNote: "Payment is taken at booking to secure your place.",
    loading: "Loading class times",
    iframeTitle: (label: string) => `Book a ${label} trial class`,
  },

  explainer: {
    eyebrow: "Programmes",
    heading: "Which programme is right for me?",
    close: "Close",
    /* Placeholder copy. Replace with the coach's text. Keys match calendar slugs. */
    items: {
      "adult-beginners":
        "New to Brazilian Jiu Jitsu or coming back after a long break? Start here. Fundamentals taught step by step in a gi, with no experience needed.",
      gi: "For people who already know the basics. Technique and live rolling in the traditional gi, with grips and lapel work.",
      "no-gi":
        "Grappling in rash guard and shorts. Faster paced, with more focus on wrestling and leg locks. Best once you're comfortable with the fundamentals.",
      "adult-striking":
        "Stand-up striking for MMA, covering stance, footwork, punches and kicks. Open to all levels, no grappling experience needed.",
    } as Record<string, string>,
  },
};
