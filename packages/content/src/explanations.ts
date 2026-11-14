import type { ConceptId } from "@gaps/domain";
import type { ConceptExplanation } from "./types";

export const EXPLANATIONS: Readonly<Record<ConceptId, ConceptExplanation>> = {
  "MATH-FRAC-PART": {
    conceptId: "MATH-FRAC-PART",
    picture: [
      {
        t: "text",
        v: "Picture a round roti cut into equal slices. The bottom number tells how many total slices exist. The top number shows how many slices are taken. Equal size matters.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Aarav shares a chocolate bar with friends. The bar breaks into 4 equal blocks. He eats 1 block. He eats one fourth of the chocolate.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "First, count all the equal pieces in the whole. Write this at the bottom. Next, count the shaded pieces. Write this number on top.",
      },
    ],
  },
  "MATH-FRAC-NUMLINE": {
    conceptId: "MATH-FRAC-NUMLINE",
    picture: [
      {
        t: "text",
        v: "Look at the line from 0 to 1. Divide that distance into equal steps. Each step is a unit fraction. The mark shows where you land.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Diya runs a one-kilometre track. She stops at each water station. Four stations divide the track evenly. At station three, she has covered three fourths.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Count the equal gaps between 0 and 1. That is your denominator. Count how many hops from 0 to the dot. That is your numerator.",
      },
    ],
  },
  "MATH-NUM-HCF": {
    conceptId: "MATH-NUM-HCF",
    picture: [
      {
        t: "text",
        v: "Factors are numbers that divide evenly with zero remainder. Common factors divide both numbers. The highest common factor is the largest number in both lists.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Rohan packs 12 laddoos and 18 barfis into identical gift boxes. He wants equal boxes without leftovers. The biggest box holds 6 of each sweet.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "List the factors of the first number. List the factors of the second number. Circle the numbers that appear in both. Pick the greatest one.",
      },
    ],
  },
  "MATH-FRAC-EQUIV": {
    conceptId: "MATH-FRAC-EQUIV",
    picture: [
      {
        t: "text",
        v: "Two fraction bars can have the exact same shaded length. One bar has bigger pieces. The other has smaller pieces. Both cover the exact same amount.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Meera cuts half a paratha into two equal slices. Now she has two quarters. Two quarters fill the same tummy space as one half.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Pick a whole number like 2 or 3. Multiply both top and bottom by this number. The new fraction has the exact same value.",
      },
    ],
  },
  "MATH-FRAC-SIMPLIFY": {
    conceptId: "MATH-FRAC-SIMPLIFY",
    picture: [
      {
        t: "text",
        v: "Simplifying bundles smaller slices into bigger chunks. The total shaded area never changes. We use fewer, larger pieces to describe the same fraction.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Kavita spent 50 rupees out of 100 rupees at the mela. Fifty hundredths sounds complicated. Saying she spent half her pocket money is simple.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Find the HCF of the numerator and denominator. Divide both top and bottom by this common factor. When no common factor remains, it is simplest.",
      },
    ],
  },
  "MATH-FRAC-COMPARE": {
    conceptId: "MATH-FRAC-COMPARE",
    picture: [
      {
        t: "text",
        v: "Place two fraction bars side by side starting at zero. The bar that stretches further is the greater fraction. Look at the total shaded length.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "In a cricket match, Rahul scored in 3 out of 5 overs. Arjun scored in 5 out of 8 overs. Making equal overs shows who scored more.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Find a common denominator using the LCM of the bottom numbers. Convert both fractions to this common denominator. Compare the numerators directly.",
      },
    ],
  },
  "MATH-FRAC-MIXED": {
    conceptId: "MATH-FRAC-MIXED",
    picture: [
      {
        t: "text",
        v: "Two whole rotis and one third of another roti make seven thirds. Whole shapes and leftover fractions describe the exact same total food.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Ananya ordered three pizzas for her family. They ate two full pizzas and half of the third. That is two and a half pizzas in total.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "To convert mixed to improper, multiply whole number by denominator. Add the numerator. Keep the same denominator on the bottom.",
      },
    ],
  },
  "MATH-NUM-LCM": {
    conceptId: "MATH-NUM-LCM",
    picture: [
      {
        t: "text",
        v: "Imagine stepping stones along a garden path. One frog jumps 4 stones each hop. Another frog jumps 6 stones. Both frogs land together at stone 12.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "A school bell rings every 15 minutes. Another bell rings every 20 minutes. Both bells ring together every 60 minutes.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "List the multiples of each number by counting by that number. Find the numbers that appear on both lists. Choose the smallest positive one.",
      },
    ],
  },
  "MATH-FRAC-ADDLIKE": {
    conceptId: "MATH-FRAC-ADDLIKE",
    picture: [
      {
        t: "text",
        v: "When slices are already the same size, you just count how many slices you have. The slice size on the bottom stays unchanged.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Pooja had two eighths of a watermelon. Her brother gave her three eighths more. Together she has five eighths of the watermelon.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Check that the denominators are identical. Add or subtract the numerators on top. Write the result over the unchanged denominator. Simplify if needed.",
      },
    ],
  },
  "MATH-FRAC-ADDUNLIKE": {
    conceptId: "MATH-FRAC-ADDUNLIKE",
    picture: [
      {
        t: "text",
        v: "You cannot add thirds to quarters directly because the slices differ in size. Cut both into twelfths. Now all pieces match and can be combined.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Vikram poured half a cup of milk into a bowl. Later he added one third of a cup. Changing both to sixths gives five sixths.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Find the LCM of the denominators. Rewrite each fraction with this common denominator. Add the numerators. Keep the common denominator.",
      },
    ],
  },
  "MATH-FRAC-MULT": {
    conceptId: "MATH-FRAC-MULT",
    picture: [
      {
        t: "text",
        v: "Take a grid representing one whole. Shade half horizontally. Shade two thirds vertically. The overlapping region shows the product of the two fractions.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Sita has half a litre of mango juice. She drinks half of what is in the bottle. She drank one quarter of a litre.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Multiply the top numbers together for the new numerator. Multiply the bottom numbers together for the new denominator. Simplify the resulting fraction.",
      },
    ],
  },
  "MATH-FRAC-DIV": {
    conceptId: "MATH-FRAC-DIV",
    picture: [
      {
        t: "text",
        v: "Dividing asks how many smaller pieces fit inside a bigger amount. Cutting each piece into halves doubles the total number of slices you get.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Dev has 3 metres of colourful ribbon for craft. Each bow requires one half of a metre. He can make six bows in total.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Keep the first fraction unchanged. Change the division sign to multiplication. Flip the second fraction upside down. Multiply across and simplify.",
      },
    ],
  },
  "MATH-FRAC-DEC": {
    conceptId: "MATH-FRAC-DEC",
    picture: [
      {
        t: "text",
        v: "A grid with 100 squares represents one whole unit. Twenty-five shaded squares represent twenty-five hundredths. We write this as zero point two five.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Fifty paise is half of one rupee. In decimal rupees we write zero point five zero. Fractions and decimals are two ways to say one amount.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Convert the fraction denominator to 10 or 100 using equivalent fractions. Write the numerator after the decimal point matching place value.",
      },
    ],
  },
  "MATH-FRAC-WORD": {
    conceptId: "MATH-FRAC-WORD",
    picture: [
      {
        t: "text",
        v: "Draw a bar model to represent the total quantity in the story. Label the parts you know and the part you need to find.",
      },
    ],
    everyday: [
      {
        t: "text",
        v: "Neha baked 24 cupcakes for a school picnic. Three quarters of them were vanilla. That means 18 cupcakes were vanilla and 6 were chocolate.",
      },
    ],
    steps: [
      {
        t: "text",
        v: "Read the story carefully. Identify whether to add, subtract, multiply, or divide. Compute the value using fraction rules and state units.",
      },
    ],
  },
};
