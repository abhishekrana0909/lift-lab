/*
 * Lift Lab engine: body numbers, diet planner, workout planner, unlock codes.
 * Pure functions only. No DOM access here, so the same file powers index.html and coach.html.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Body numbers                                                        */
  /* ------------------------------------------------------------------ */

  const ACTIVITY = {
    sedentary: { factor: 1.2,   label: 'Mostly sitting',     hint: 'Desk job, under 5,000 steps, no exercise' },
    light:     { factor: 1.375, label: 'Lightly active',     hint: 'Exercise 1–3 days a week' },
    moderate:  { factor: 1.55,  label: 'Moderately active',  hint: 'Exercise 3–5 days a week' },
    very:      { factor: 1.725, label: 'Very active',        hint: 'Hard training 6–7 days a week' },
    athlete:   { factor: 1.9,   label: 'Extremely active',   hint: 'Physical job plus daily training' },
  };

  // calFactor multiplies maintenance calories. Protein is grams per kg of reference weight.
  const GOALS = {
    lose:     { label: 'Lose fat',          calFactor: 0.80, proteinPerKg: 2.0, fatShare: 0.25 },
    maintain: { label: 'Recomp / maintain', calFactor: 1.00, proteinPerKg: 1.8, fatShare: 0.27 },
    gain:     { label: 'Build muscle',      calFactor: 1.10, proteinPerKg: 1.8, fatShare: 0.25 },
  };

  const LIMITS = {
    age:    { min: 18,  max: 80 },
    height: { min: 130, max: 220 },
    weight: { min: 35,  max: 200 },
  };

  function bmi(weightKg, heightCm) {
    const m = heightCm / 100;
    return weightKg / (m * m);
  }

  // Asian / Indian cut-offs (WHO expert consultation 2004, Indian consensus guidelines 2009).
  function bmiCategory(v) {
    if (v < 18.5) return { key: 'under',  label: 'Underweight', flag: 'LOW' };
    if (v < 23)   return { key: 'normal', label: 'Normal',      flag: 'NORMAL' };
    if (v < 25)   return { key: 'over',   label: 'Overweight',  flag: 'HIGH' };
    return               { key: 'obese',  label: 'Obese',       flag: 'HIGH' };
  }

  // International WHO cut-offs, shown for comparison.
  function bmiCategoryWHO(v) {
    if (v < 18.5) return 'Underweight';
    if (v < 25)   return 'Normal';
    if (v < 30)   return 'Overweight';
    return 'Obese';
  }

  // Mifflin–St Jeor (1990).
  function bmr({ sex, weight, height, age }) {
    return 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  }

  function validate(input) {
    const errors = {};
    for (const key of ['age', 'height', 'weight']) {
      const v = input[key];
      const { min, max } = LIMITS[key];
      if (!Number.isFinite(v)) errors[key] = 'Enter a number';
      else if (v < min || v > max) errors[key] = `Enter a value between ${min} and ${max}`;
    }
    if (input.age < 18 && Number.isFinite(input.age)) {
      errors.age = 'These formulas are for adults (18+). Under 18? Talk to Dwon directly.';
    }
    return errors;
  }

  function round(v, step) { return Math.round(v / step) * step; }

  function analyse(input) {
    const { sex, age, height, weight, activity, goal } = input;
    const m = height / 100;
    const g = GOALS[goal];

    const bmiValue = bmi(weight, height);
    const base = bmr({ sex, weight, height, age });
    const tdee = base * ACTIVITY[activity].factor;

    let target = tdee * g.calFactor;
    let floored = false;
    const floor = sex === 'male' ? 1500 : 1200;
    if (goal === 'lose' && target < floor) {
      target = Math.min(floor, tdee);
      floored = true;
    }
    target = round(target, 10);

    // For higher body weights, protein is based on the weight at BMI 25, not total weight.
    const refWeight = Math.min(weight, 25 * m * m);
    const protein = round(g.proteinPerKg * refWeight, 5);
    const fat = Math.round(Math.max((g.fatShare * target) / 9, 0.6 * refWeight));
    const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
    const fibre = Math.round((14 * target) / 1000);
    const water = Math.round(weight * 0.035 * 10) / 10;
    const weeklyChange = ((target - tdee) * 7) / 7700; // kg per week, 7,700 kcal per kg of body fat

    return {
      input,
      bmi: bmiValue,
      category: bmiCategory(bmiValue),
      categoryWHO: bmiCategoryWHO(bmiValue),
      healthyRange: [18.5 * m * m, 22.9 * m * m],
      bmr: base,
      tdee,
      target,
      floored,
      protein,
      carbs,
      fat,
      fibre,
      water,
      weeklyChange,
      proteinPerKg: g.proteinPerKg,
      refWeight,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Foods                                                               */
  /* Values per `per` units. Sources: USDA FoodData Central, IFCT 2017,  */
  /* and Indian pack labels (Amul, Nutrela) for paneer, milk and soya.   */
  /* ------------------------------------------------------------------ */

  const FOODS = {
    egg:      { name: 'Whole eggs',                       unit: 'egg',    units: 'eggs',    per: 1,   step: 1,   kcal: 72,  p: 6.3,  c: 0.4,  f: 4.8 },
    eggWhite: { name: 'Egg whites',                       unit: 'white',  units: 'whites',  per: 1,   step: 1,   kcal: 17,  p: 3.6,  c: 0.2,  f: 0.1 },
    chicken:  { name: 'Chicken breast, cooked',           unit: 'g',                        per: 100, step: 10,  kcal: 165, p: 31,   c: 0,    f: 3.6 },
    fish:     { name: 'Fish (rohu / basa), cooked',       unit: 'g',                        per: 100, step: 10,  kcal: 128, p: 26,   c: 0,    f: 2.7 },
    paneer:   { name: 'Paneer',                           unit: 'g',                        per: 100, step: 10,  kcal: 265, p: 18.3, c: 1.2,  f: 20.8 },
    tofu:     { name: 'Tofu, firm',                       unit: 'g',                        per: 100, step: 10,  kcal: 144, p: 17.3, c: 2.8,  f: 8.7 },
    soya:     { name: 'Soya chunks (dry weight)',         unit: 'g',                        per: 100, step: 5,   kcal: 345, p: 52,   c: 33,   f: 0.5 },
    greek:    { name: 'Hung curd / Greek yogurt',         unit: 'g',                        per: 100, step: 25,  kcal: 73,  p: 10,   c: 3.9,  f: 1.9 },
    curd:     { name: 'Curd (dahi)',                      unit: 'g',                        per: 100, step: 25,  kcal: 61,  p: 3.5,  c: 4.7,  f: 3.3, katori: 150 },
    milk:     { name: 'Toned milk',                       unit: 'ml',                       per: 100, step: 50,  kcal: 58,  p: 3.1,  c: 4.7,  f: 3.0, glass: 250 },
    soyMilk:  { name: 'Soy milk, unsweetened',            unit: 'ml',                       per: 100, step: 50,  kcal: 33,  p: 2.9,  c: 1.7,  f: 1.7, glass: 250 },
    whey:     { name: 'Whey protein',                     unit: 'scoop',  units: 'scoops',  per: 1,   step: 0.5, kcal: 120, p: 24,   c: 3,    f: 1.5 },
    plantPro: { name: 'Plant protein powder',             unit: 'scoop',  units: 'scoops',  per: 1,   step: 0.5, kcal: 120, p: 22,   c: 4,    f: 2 },
    dal:      { name: 'Dal (moong / masoor / toor), cooked', unit: 'g',                     per: 100, step: 25,  kcal: 116, p: 9,    c: 20,   f: 0.4, katori: 150 },
    rajma:    { name: 'Rajma, cooked',                    unit: 'g',                        per: 100, step: 25,  kcal: 127, p: 8.7,  c: 22.8, f: 0.5, katori: 150 },
    chole:    { name: 'Chole, cooked',                    unit: 'g',                        per: 100, step: 25,  kcal: 164, p: 8.9,  c: 27.4, f: 2.6, katori: 150 },
    besan:    { name: 'Besan (for chilla)',               unit: 'g',                        per: 100, step: 10,  kcal: 387, p: 22.4, c: 57.8, f: 6.7 },
    chana:    { name: 'Roasted chana',                    unit: 'g',                        per: 100, step: 5,   kcal: 369, p: 22.5, c: 58,   f: 5.2 },
    peanuts:  { name: 'Peanuts, roasted',                 unit: 'g',                        per: 100, step: 5,   kcal: 567, p: 25.8, c: 16.1, f: 49.2 },
    pb:       { name: 'Peanut butter',                    unit: 'tbsp',   units: 'tbsp',    per: 1,   step: 0.5, kcal: 96,  p: 3.6,  c: 3.6,  f: 8.2 },
    almonds:  { name: 'Almonds',                          unit: 'g',                        per: 100, step: 5,   kcal: 579, p: 21.2, c: 21.6, f: 49.9 },
    makhana:  { name: 'Roasted makhana',                  unit: 'g',                        per: 100, step: 5,   kcal: 347, p: 9.7,  c: 76.9, f: 0.1 },
    ghee:     { name: 'Ghee',                             unit: 'tsp',    units: 'tsp',     per: 1,   step: 1,   kcal: 45,  p: 0,    c: 0,    f: 5 },
    oil:      { name: 'Cooking oil',                      unit: 'tsp',    units: 'tsp',     per: 1,   step: 1,   kcal: 45,  p: 0,    c: 0,    f: 5 },
    roti:     { name: 'Whole-wheat roti (no ghee)',       unit: 'roti',   units: 'rotis',   per: 1,   step: 1,   kcal: 100, p: 3.5,  c: 21,   f: 0.5 },
    rice:     { name: 'Rice, cooked',                     unit: 'g',                        per: 100, step: 25,  kcal: 130, p: 2.7,  c: 28.2, f: 0.3, katori: 150 },
    oats:     { name: 'Rolled oats (dry)',                unit: 'g',                        per: 100, step: 10,  kcal: 379, p: 13.2, c: 67.7, f: 6.5 },
    poha:     { name: 'Poha (dry)',                       unit: 'g',                        per: 100, step: 10,  kcal: 346, p: 6.6,  c: 77.3, f: 1.2 },
    bread:    { name: 'Whole-wheat bread',                unit: 'slice',  units: 'slices',  per: 1,   step: 1,   kcal: 69,  p: 3.6,  c: 11.6, f: 1.0 },
    banana:   { name: 'Banana, medium',                   unit: 'banana', units: 'bananas', per: 1,   step: 0.5, kcal: 105, p: 1.3,  c: 27,   f: 0.4 },
    fruit:    { name: 'Seasonal fruit (papaya / guava / orange)', unit: 'bowl', units: 'bowls', per: 1, step: 0.5, kcal: 60, p: 1,  c: 14,   f: 0.3 },
    sweetPotato: { name: 'Sweet potato, boiled',          unit: 'g',                        per: 100, step: 25,  kcal: 76,  p: 1.4,  c: 17.7, f: 0.1 },
    sabzi:    { name: 'Green sabzi (oil counted separately)', unit: 'g',                    per: 100, step: 25,  kcal: 45,  p: 2,    c: 8,    f: 0.4, katori: 150 },
    salad:    { name: 'Salad (cucumber, tomato, onion)',  unit: 'g',                        per: 100, step: 50,  kcal: 20,  p: 1,    c: 4,    f: 0.1 },
    sprouts:  { name: 'Moong sprouts',                    unit: 'g',                        per: 100, step: 25,  kcal: 30,  p: 3,    c: 5.9,  f: 0.2 },
  };

  function perUnit(id) {
    const f = FOODS[id];
    return { kcal: f.kcal / f.per, p: f.p / f.per, c: f.c / f.per, f: f.f / f.per };
  }

  /* ------------------------------------------------------------------ */
  /* Meal templates                                                      */
  /* Each template names a protein lever (P), a carb lever (C) and an    */
  /* optional fat lever (F). Fixed items go in first, then the levers    */
  /* are solved so the meal lands on its share of the day's macros.      */
  /* A value given as an object is picked by diet type.                  */
  /* ------------------------------------------------------------------ */

  const SHAKE = (ctx) => (ctx.vegan ? 'plantPro' : 'whey');

  const MEALS = [
    {
      key: 'breakfast', label: 'Breakfast', time: '8:00', share: 0.25,
      templates: [
        { diets: ['nonveg', 'egg'], title: 'Masala omelette & toast',
          fixed: [['egg', 2], ['sabzi', 50], ['oil', 1], ['fruit', 1]],
          P: ['eggWhite', 0, 8], C: ['bread', 1, 4] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: (ctx) => (ctx.whey ? 'Protein oats bowl' : ctx.vegan ? 'Oats bowl with soy milk' : 'Oats bowl with hung curd'),
          fixed: (ctx) => [[ctx.vegan ? 'soyMilk' : 'milk', 200], ['banana', 1]],
          P: (ctx) => (ctx.whey ? [SHAKE(ctx), 0, 1.5] : ctx.vegan ? ['soyMilk', 0, 300] : ['greek', 0, 250]),
          C: ['oats', 30, 100], F: ['almonds', 0, 25] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'], title: (ctx) => (ctx.vegan ? 'Besan chilla with tofu' : 'Besan chilla with hung curd'),
          fixed: [['sabzi', 50], ['oil', 1]],
          P: (ctx) => (ctx.vegan ? ['tofu', 0, 200] : ['greek', 0, 250]),
          C: ['besan', 40, 100] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: { nonveg: 'Egg bhurji & roti', egg: 'Egg bhurji & roti', veg: 'Paneer bhurji, roti & hung curd', vegan: 'Tofu bhurji & roti' },
          fixed: (ctx) => (ctx.eggs ? [['egg', 2], ['sabzi', 50], ['oil', 1]]
            : ctx.diet === 'veg' ? [['paneer', 60], ['sabzi', 50], ['oil', 1]]
            : [['sabzi', 50], ['oil', 1]]),
          P: { nonveg: ['eggWhite', 0, 8], egg: ['eggWhite', 0, 8], veg: ['greek', 0, 250], vegan: ['tofu', 100, 250] },
          C: ['roti', 1, 4] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'], title: (ctx) => (ctx.vegan ? 'Poha with peanuts & soy milk' : 'Poha with peanuts & hung curd'),
          fixed: [['peanuts', 10], ['sabzi', 50], ['oil', 1]],
          P: (ctx) => (ctx.vegan ? ['soyMilk', 0, 400] : ['greek', 0, 250]),
          C: ['poha', 40, 90] },
      ],
    },
    {
      key: 'mid', label: 'Mid-morning', time: '11:00', share: 0.10,
      templates: [
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: (ctx) => (ctx.whey ? 'Protein shake & fruit' : ctx.vegan ? 'Roasted chana & fruit' : 'Greek yogurt & fruit'),
          fixed: [['fruit', 1]],
          P: (ctx) => (ctx.whey ? [SHAKE(ctx), 0.5, 1.5] : ctx.vegan ? ['chana', 15, 60] : ['greek', 100, 300]) },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'], title: 'Sprouts chaat with roasted chana',
          fixed: [['sprouts', 100], ['salad', 50]],
          P: ['chana', 10, 50] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'], title: 'Makhana & almonds',
          fixed: [['almonds', 10]],
          P: (ctx) => (ctx.whey ? [SHAKE(ctx), 0, 1] : ['chana', 0, 30]), C: ['makhana', 10, 40] },
      ],
    },
    {
      key: 'lunch', label: 'Lunch', time: '13:30', share: 0.30,
      templates: [
        { diets: ['nonveg'], title: 'Chicken curry, rice & dal',
          fixed: [['dal', 100], ['sabzi', 100], ['salad', 100]],
          P: ['chicken', 75, 250], C: ['rice', 100, 400], F: ['oil', 0, 3] },
        { diets: ['nonveg', 'egg', 'veg'], title: 'Rajma chawal & hung-curd raita',
          fixed: [['rajma', 150], ['salad', 100]],
          P: ['greek', 0, 300], C: ['rice', 75, 350], F: ['oil', 0, 3] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'], title: 'Soya chunk curry & roti',
          fixed: [['sabzi', 100], ['salad', 100]],
          P: ['soya', 20, 70], C: ['roti', 1, 5], F: ['oil', 1, 3] },
        { diets: ['nonveg'], title: 'Fish curry, rice & sabzi',
          fixed: [['sabzi', 150], ['salad', 100]],
          P: ['fish', 100, 250], C: ['rice', 100, 400], F: ['oil', 0, 3] },
        { diets: ['egg'], title: 'Egg curry & roti',
          fixed: [['sabzi', 100], ['salad', 100]],
          P: ['egg', 2, 5], C: ['roti', 1, 5], F: ['oil', 0, 2] },
        { diets: ['veg'], title: 'Dal, roti, paneer sabzi & raita',
          fixed: [['dal', 150], ['paneer', 50], ['sabzi', 100], ['salad', 100]],
          P: ['greek', 0, 300], C: ['roti', 1, 5], F: ['oil', 0, 2] },
        { diets: ['vegan'], title: 'Chole, rice & tofu tikka',
          fixed: [['chole', 150], ['salad', 100]],
          P: ['tofu', 100, 250], C: ['rice', 75, 350], F: ['oil', 0, 2] },
      ],
    },
    {
      key: 'evening', label: 'Evening', time: '17:30', share: 0.10,
      templates: [
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: (ctx) => (ctx.whey ? 'Post-workout shake & banana' : ctx.vegan ? 'Soy milk & banana' : 'Greek yogurt & banana'),
          fixed: [['banana', 1]],
          P: (ctx) => (ctx.whey ? [SHAKE(ctx), 0.5, 1.5] : ctx.vegan ? ['soyMilk', 150, 400] : ['greek', 100, 300]) },
        { diets: ['nonveg', 'egg'], title: 'Boiled eggs & fruit',
          fixed: [['egg', 1], ['fruit', 1]],
          P: ['eggWhite', 0, 5] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'], title: 'Roasted chana & makhana',
          fixed: [['makhana', 15]],
          P: ['chana', 15, 50] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: (ctx) => (ctx.vegan ? 'Peanut butter toast & soy milk' : 'Peanut butter toast & milk'),
          fixed: [['bread', 1], ['pb', 1]],
          P: (ctx) => (ctx.vegan ? ['soyMilk', 150, 400] : ['milk', 150, 350]) },
      ],
    },
    {
      key: 'dinner', label: 'Dinner', time: '20:30', share: 0.25,
      templates: [
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: { nonveg: 'Chicken tikka, roti & sabzi', egg: 'Egg bhurji, roti & sabzi', veg: 'Paneer bhurji, roti, sabzi & raita', vegan: 'Tofu bhurji, roti & sabzi' },
          fixed: (ctx) => (ctx.diet === 'egg' ? [['egg', 2], ['sabzi', 150], ['salad', 100]]
            : ctx.diet === 'veg' ? [['paneer', 75], ['sabzi', 150], ['salad', 100]]
            : [['sabzi', 150], ['salad', 100]]),
          P: { nonveg: ['chicken', 75, 250], egg: ['eggWhite', 0, 8], veg: ['greek', 0, 250], vegan: ['tofu', 100, 300] },
          C: ['roti', 1, 5], F: ['oil', 0, 3] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: (ctx) => (ctx.vegan ? 'Dal, rice, sabzi & tofu' : 'Dal, rice, sabzi & raita'),
          fixed: [['dal', 150], ['sabzi', 100]],
          P: (ctx) => (ctx.vegan ? ['tofu', 0, 250] : ['greek', 0, 250]),
          C: ['rice', 75, 350], F: ['oil', 0, 3] },
        { diets: ['nonveg'], title: 'Grilled chicken & sweet potato',
          fixed: [['sabzi', 150], ['salad', 100]],
          P: ['chicken', 75, 250], C: ['sweetPotato', 100, 450], F: ['oil', 0, 3] },
        { diets: ['nonveg', 'egg', 'veg', 'vegan'],
          title: (ctx) => (ctx.vegan ? 'Soya pulao & salad' : 'Soya pulao & curd'),
          fixed: (ctx) => (ctx.vegan ? [['sabzi', 100], ['salad', 100]] : [['sabzi', 100], ['curd', 100]]),
          P: ['soya', 20, 70], C: ['rice', 75, 350], F: ['oil', 1, 3] },
      ],
    },
  ];

  function pickByDiet(value, ctx) {
    if (typeof value === 'function') return value(ctx);
    if (value && !Array.isArray(value) && typeof value === 'object') return value[ctx.diet];
    return value;
  }

  function clampStep(amount, [id, min, max]) {
    const step = FOODS[id].step;
    return Math.min(max, Math.max(min, round(amount, step)));
  }

  // Templates are written for a ~2,200 kcal day. `sf` scales portions for smaller or bigger days.
  const NO_SCALE = new Set(['sabzi', 'salad', 'sprouts', 'oil']);

  function scaleFixed(list, sf) {
    return list.map(([id, amount]) => {
      if (NO_SCALE.has(id)) return [id, amount];
      const step = FOODS[id].step;
      return [id, Math.max(step, round(amount * sf, step))];
    });
  }

  function scaleRange(range, sf) {
    if (!range) return range;
    const [id, min, max] = range;
    const step = FOODS[id].step;
    const lo = min === 0 ? 0 : Math.max(step, round(min * Math.min(1, sf), step));
    const hi = Math.max(lo, step, round(max * Math.max(1, sf), step));
    return [id, lo, hi];
  }

  function addTo(total, id, amount) {
    const u = perUnit(id);
    total.kcal += u.kcal * amount;
    total.p += u.p * amount;
    total.c += u.c * amount;
    total.f += u.f * amount;
  }

  function sumItems(items) {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const it of items) addTo(t, it.id, it.amount);
    return t;
  }

  // Solve one meal so it lands on its macro targets.
  function solveMeal(template, target, ctx) {
    const fixed = scaleFixed(pickByDiet(template.fixed, ctx) || [], ctx.sf).map(([id, amount]) => ({ id, amount, role: 'fixed' }));
    const P = scaleRange(pickByDiet(template.P, ctx), ctx.sf);
    const C = scaleRange(pickByDiet(template.C, ctx), ctx.sf);
    const F = scaleRange(pickByDiet(template.F, ctx), ctx.sf);

    const base = sumItems(fixed);
    const needP = Math.max(0, target.p - base.p);
    const needC = Math.max(0, target.c - base.c);

    let x = 0; // protein lever amount
    let y = 0; // carb lever amount

    if (P && C) {
      const a = perUnit(P[0]);
      const b = perUnit(C[0]);
      const det = a.p * b.c - b.p * a.c;
      if (Math.abs(det) > 1e-9) {
        x = (needP * b.c - b.p * needC) / det;
        y = (a.p * needC - needP * a.c) / det;
      }
      // If one lever falls outside its range, clamp it and re-solve the other from its own macro.
      if (x < P[1] || x > P[2] || !Number.isFinite(x)) {
        x = Math.min(P[2], Math.max(P[1], Number.isFinite(x) ? x : P[1]));
        y = b.c > 0 ? (needC - a.c * x) / b.c : 0;
      }
      if (y < C[1] || y > C[2]) {
        y = Math.min(C[2], Math.max(C[1], y));
        x = a.p > 0 ? (needP - b.p * y) / a.p : 0;
      }
      x = clampStep(x, P);
      y = clampStep(y, C);
    } else if (P) {
      const a = perUnit(P[0]);
      x = clampStep(a.p > 0 ? needP / a.p : 0, P);
    } else if (C) {
      const b = perUnit(C[0]);
      y = clampStep(b.c > 0 ? needC / b.c : 0, C);
    }

    const items = fixed.slice();
    if (P) items.push({ id: P[0], amount: x, role: 'P', range: P });
    if (C) items.push({ id: C[0], amount: y, role: 'C', range: C });

    if (F) {
      const sofar = sumItems(items);
      const u = perUnit(F[0]);
      const z = clampStep(u.f > 0 ? (target.f - sofar.f) / u.f : 0, F);
      items.push({ id: F[0], amount: z, role: 'F', range: F });
    }

    // Merge duplicate foods (for example soy milk as a fixed item and as the protein lever).
    const merged = [];
    for (const it of items) {
      const prev = merged.find((m) => m.id === it.id);
      if (prev) {
        prev.amount += it.amount;
        if (it.role !== 'fixed') { prev.role = it.role; prev.range = it.range; prev.fixedPart = (prev.fixedPart || 0) + (prev.amount - it.amount); }
      } else merged.push({ ...it });
    }
    // List the main protein and carb first, then the sides, then cooking fat.
    const rank = { P: 0, C: 1, fixed: 2, F: 3 };
    return merged.filter((it) => it.amount > 0).sort((a, b) => rank[a.role] - rank[b.role]);
  }

  function mealTitle(template, ctx) {
    return pickByDiet(template.title, ctx);
  }

  // Foods that make a meal feel like "the same thing again" if they show up twice in a day.
  const DISTINCT = { chicken: 'chicken', fish: 'fish', paneer: 'paneer', tofu: 'tofu', soya: 'soya', egg: 'egg', eggWhite: 'egg',
    makhana: 'makhana', chana: 'chana', rajma: 'rajma', chole: 'chole', besan: 'besan', oats: 'oats', poha: 'poha', sweetPotato: 'sweetPotato' };

  function mainFoods(template, ctx) {
    const ids = (pickByDiet(template.fixed, ctx) || []).map(([id]) => id);
    for (const lever of [template.P, template.C]) {
      const r = pickByDiet(lever, ctx);
      if (r) ids.push(r[0]);
    }
    return [...new Set(ids.map((id) => DISTINCT[id]).filter(Boolean))];
  }

  function totalsOf(meals) {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const m of meals) {
      for (const it of m.items) addTo(t, it.id, it.amount);
    }
    return t;
  }

  // Nudge lever items in whole steps to close the gap between the plan and the target.
  function correctDay(meals, report) {
    const tune = (macro, roles, order, tolerance) => {
      for (let pass = 0; pass < 40; pass++) {
        const totals = totalsOf(meals);
        const gap = macro === 'kcal' ? report.target - totals.kcal : report[{ p: 'protein', c: 'carbs', f: 'fat' }[macro]] - totals[macro];
        if (Math.abs(gap) <= tolerance) return;
        let moved = false;
        // Rotate the starting meal each pass so changes spread across the day.
        const rotated = order.slice(pass % order.length).concat(order.slice(0, pass % order.length));
        for (const key of rotated) {
          const meal = meals.find((m) => m.key === key);
          if (!meal) continue;
          // Roles are tried in the order given, so ['C', 'F', 'P'] moves carbs before fat before protein.
          for (const role of roles) {
            const item = meal.items.find((it) => it.role === role && it.range);
            if (!item) continue;
            if (perUnit(item.id)[macro] <= 0) continue;
            const fixedPart = item.fixedPart || 0;
            const lever = item.amount - fixedPart;
            const want = lever + Math.sign(gap) * FOODS[item.id].step;
            const next = Math.min(item.range[2], Math.max(item.range[1], want));
            if (next !== lever) {
              item.amount = next + fixedPart;
              moved = true;
              break;
            }
          }
          if (moved) break;
        }
        if (!moved) return;
      }
    };
    const kcalTolerance = Math.max(50, report.target * 0.03);
    const all = ['lunch', 'dinner', 'breakfast', 'mid', 'evening'];
    tune('p', ['P'], ['mid', 'evening', 'dinner', 'lunch', 'breakfast'], 6);
    tune('f', ['F'], ['lunch', 'dinner', 'breakfast'], 6);
    tune('kcal', ['C'], ['lunch', 'dinner', 'breakfast', 'mid'], kcalTolerance);
    // Last resort when carbs alone cannot close the gap: move fat, then protein portions.
    tune('kcal', ['C', 'F', 'P'], all, kcalTolerance);
    for (const m of meals) m.items = m.items.filter((it) => it.amount > 0);
  }

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function dietPlan(report, prefs) {
    const ctx = {
      diet: prefs.diet,
      whey: !!prefs.whey,
      vegan: prefs.diet === 'vegan',
      eggs: prefs.diet === 'egg' || prefs.diet === 'nonveg',
      sf: Math.min(1.9, Math.max(0.55, report.target / 2200)),
    };
    const days = [];
    for (let d = 0; d < 7; d++) {
      const used = new Set();
      const meals = MEALS.map((slot, slotIndex) => {
        const options = slot.templates.filter((t) => t.diets.includes(ctx.diet));
        const start = (d + slotIndex * 2) % options.length;
        // Rotate through the options, skipping any whose main food already appears today.
        let template = options[start];
        for (let k = 0; k < options.length; k++) {
          const candidate = options[(start + k) % options.length];
          if (!mainFoods(candidate, ctx).some((f) => used.has(f))) { template = candidate; break; }
        }
        mainFoods(template, ctx).forEach((f) => used.add(f));
        const target = {
          p: report.protein * slot.share,
          c: report.carbs * slot.share,
          f: report.fat * slot.share,
        };
        return {
          key: slot.key,
          label: slot.label,
          time: slot.time,
          title: mealTitle(template, ctx),
          items: solveMeal(template, target, ctx),
        };
      });
      correctDay(meals, report);
      const totals = totalsOf(meals);
      days.push({ name: DAY_NAMES[d], meals, totals });
    }
    return days;
  }

  /* ------------------------------------------------------------------ */
  /* Workout planner                                                     */
  /* ------------------------------------------------------------------ */

  // [beginner, intermediate, advanced] per pattern and location.
  const EXERCISES = {
    gym: {
      squat:   ['Goblet squat', 'Barbell back squat', 'Barbell back squat'],
      hinge:   ['Dumbbell Romanian deadlift', 'Barbell Romanian deadlift', 'Conventional deadlift'],
      lunge:   ['Dumbbell walking lunge', 'Dumbbell walking lunge', 'Bulgarian split squat'],
      legPress:['Leg press', 'Leg press', 'Hack squat or leg press'],
      quadIso: ['Leg extension', 'Leg extension', 'Leg extension'],
      hamIso:  ['Lying leg curl', 'Seated leg curl', 'Seated leg curl'],
      calf:    ['Standing calf raise', 'Standing calf raise', 'Standing calf raise'],
      hPush:   ['Machine chest press', 'Barbell bench press', 'Barbell bench press'],
      incPush: ['Incline dumbbell press', 'Incline dumbbell press', 'Incline barbell press'],
      vPush:   ['Seated dumbbell shoulder press', 'Seated dumbbell shoulder press', 'Standing overhead press'],
      fly:     ['Pec deck', 'Cable fly', 'Cable fly'],
      lateral: ['Dumbbell lateral raise', 'Cable lateral raise', 'Cable lateral raise'],
      vPull:   ['Lat pulldown', 'Pull-ups (use the assisted machine if needed)', 'Weighted pull-ups'],
      hRow:    ['Seated cable row', 'Chest-supported dumbbell row', 'Barbell row'],
      rear:    ['Face pull', 'Face pull', 'Reverse pec deck'],
      biceps:  ['Dumbbell curl', 'EZ-bar curl', 'Incline dumbbell curl'],
      hammer:  ['Hammer curl', 'Hammer curl', 'Cable hammer curl'],
      triceps: ['Rope pushdown', 'Rope pushdown', 'Overhead cable extension'],
      core:    ['Plank', 'Cable crunch', 'Hanging leg raise'],
    },
    home: {
      squat:   ['Bodyweight squat', 'Bulgarian split squat', 'Bulgarian split squat (backpack)'],
      hinge:   ['Glute bridge', 'Single-leg Romanian deadlift', 'Single-leg hip thrust'],
      lunge:   ['Reverse lunge', 'Walking lunge', 'Jump lunge'],
      legPress:['Step-up on a chair', 'Step-up on a chair', 'Step-up (backpack)'],
      quadIso: ['Wall sit', 'Wall sit', 'Sissy squat (hold a door frame)'],
      hamIso:  ['Sliding leg curl (towel on floor)', 'Sliding leg curl (towel on floor)', 'Single-leg sliding curl'],
      calf:    ['Calf raise on a stair', 'Single-leg calf raise on a stair', 'Single-leg calf raise (backpack)'],
      hPush:   ['Incline push-up (hands on bed)', 'Push-up', 'Deficit push-up'],
      incPush: ['Push-up', 'Decline push-up (feet on bed)', 'Archer push-up'],
      vPush:   ['Pike push-up', 'Pike push-up', 'Elevated pike push-up'],
      fly:     ['Wide push-up', 'Wide push-up', 'Pseudo-planche push-up'],
      lateral: ['Lateral raise (water bottles)', 'Lateral raise (backpack or band)', 'Lateral raise (band)'],
      vPull:   ['Doorway towel row', 'Pull-up (if you have a bar) or band pulldown', 'Pull-up'],
      hRow:    ['Backpack bent-over row', 'Table row (under a sturdy table)', 'Table row, feet raised'],
      rear:    ['Prone Y-T-W raise', 'Prone Y-T-W raise', 'Band pull-apart'],
      biceps:  ['Backpack curl', 'Backpack curl', 'Band curl'],
      hammer:  ['Towel isometric curl', 'Backpack hammer curl', 'Band hammer curl'],
      triceps: ['Chair dip', 'Diamond push-up', 'Bodyweight triceps extension'],
      core:    ['Plank', 'Dead bug', 'Hollow-body hold'],
    },
  };

  const COMPOUND = new Set(['squat', 'hinge', 'lunge', 'legPress', 'hPush', 'incPush', 'vPush', 'vPull', 'hRow']);

  const SESSIONS = {
    fullA: { name: 'Full body A', patterns: ['squat', 'hPush', 'hRow', 'hinge', 'lateral', 'core', 'biceps'] },
    fullB: { name: 'Full body B', patterns: ['hinge', 'vPush', 'vPull', 'lunge', 'incPush', 'triceps', 'core'] },
    upper: { name: 'Upper body', patterns: ['hPush', 'hRow', 'vPush', 'vPull', 'lateral', 'biceps', 'triceps'] },
    lower: { name: 'Lower body', patterns: ['squat', 'hinge', 'lunge', 'hamIso', 'calf', 'core', 'quadIso'] },
    push:  { name: 'Push · chest, shoulders, triceps', patterns: ['hPush', 'incPush', 'vPush', 'lateral', 'fly', 'triceps', 'triceps'] },
    pull:  { name: 'Pull · back, biceps', patterns: ['vPull', 'hRow', 'rear', 'biceps', 'hammer', 'core', 'hRow'] },
    legs:  { name: 'Legs', patterns: ['squat', 'hinge', 'legPress', 'quadIso', 'hamIso', 'calf', 'core'] },
  };

  const SPLITS = {
    3: { name: 'Full body, 3 days', week: ['fullA', null, 'fullB', null, 'fullA', null, null],
         note: 'Next week, swap the order: B, A, B.' },
    4: { name: 'Upper / lower, 4 days', week: ['upper', 'lower', null, 'upper', 'lower', null, null] },
    5: { name: 'Upper / lower + push / pull / legs, 5 days', week: ['upper', 'lower', null, 'push', 'pull', 'legs', null] },
    6: { name: 'Push / pull / legs, 6 days', week: ['push', 'pull', 'legs', 'push', 'pull', 'legs', null] },
  };

  const LEVEL_INDEX = { beginner: 0, intermediate: 1, advanced: 2 };

  function workoutPlan(prefs, goal) {
    const lvl = LEVEL_INDEX[prefs.level] ?? 0;
    const place = prefs.place === 'home' ? 'home' : 'gym';
    const split = SPLITS[prefs.days] || SPLITS[4];
    const count = [5, 6, 7][lvl];
    const home = place === 'home';

    const sessions = split.week.map((key, i) => {
      if (!key) return { day: DAY_NAMES[i], rest: true };
      const s = SESSIONS[key];
      const seen = new Set();
      const exercises = [];
      for (const pattern of s.patterns) {
        if (exercises.length >= count) break;
        const name = EXERCISES[place][pattern][lvl];
        if (seen.has(name)) continue;
        seen.add(name);
        const compound = COMPOUND.has(pattern);
        let sets = compound ? [3, 4, 4][lvl] : 3;
        let reps;
        if (pattern === 'core') reps = /plank|hold|dead bug/i.test(name) ? '30–45 s' : '10–15';
        else if (pattern === 'quadIso' && /wall sit/i.test(name)) reps = '30–60 s';
        else if (home) reps = compound ? '8–15' : '12–20';
        else if (compound) reps = exercises.length === 0 && lvl === 2 ? '5–8' : '6–10';
        else reps = '10–15';
        const rest = compound ? '2–3 min' : '60–90 s';
        exercises.push({ name, sets, reps, rest });
      }
      return { day: DAY_NAMES[i], rest: false, name: s.name, exercises };
    });

    const effort = [
      'Stop each set with 2–3 reps still in the tank. Learn the movement first.',
      'Finish each set 1–2 reps short of failure.',
      'Take the last set of each exercise to 0–1 reps short of failure.',
    ][lvl];

    const cardio = {
      lose:     'Walk 8,000–10,000 steps a day. Add 3 sessions of 25–35 min brisk walking or cycling, after lifting or on rest days.',
      maintain: 'Walk 7,000–9,000 steps a day. Add 2 sessions of 20–30 min easy cardio a week.',
      gain:     'Walk 6,000–8,000 steps a day. Keep cardio to 1–2 short sessions a week so you stay in a surplus.',
    }[goal];

    const progression = home
      ? 'When you hit the top of the rep range on every set, move to the harder version of the exercise or add weight to a backpack.'
      : 'When you hit the top of the rep range on every set, add 2.5 kg to upper-body lifts or 5 kg to lower-body lifts next session.';

    return {
      split: split.name,
      splitNote: split.note || '',
      place,
      sessions,
      notes: [
        { label: 'Warm-up', text: '5 minutes of light cardio, then 2 lighter sets of your first exercise.' },
        { label: 'Effort', text: effort },
        { label: 'Progression', text: progression },
        { label: 'Cardio & steps', text: cardio },
      ],
    };
  }

  /* ------------------------------------------------------------------ */
  /* Unlock codes                                                        */
  /* A code holds its own expiry date plus a signature made with the     */
  /* secret in config.js. Format: LL-XXX-YYYYY.                          */
  /* ------------------------------------------------------------------ */

  // cyrb53 string hash.
  function hash(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  const EPOCH = Date.UTC(2026, 0, 1);
  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0, 1, I or O

  function dayNumber(date) {
    return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / 86400000);
  }

  function dateFromDay(n) {
    const d = new Date(EPOCH + n * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function encode(n, len) {
    let s = '';
    for (let i = 0; i < len; i++) {
      s = ALPHABET[n % 32] + s;
      n = Math.floor(n / 32);
    }
    return s;
  }

  function decode(s) {
    let n = 0;
    for (const ch of s) {
      const i = ALPHABET.indexOf(ch);
      if (i < 0) return NaN;
      n = n * 32 + i;
    }
    return n;
  }

  function signature(payload, secret) {
    return encode(hash(`${secret}|${payload}`) % 33554432, 5); // 32^5
  }

  function makeCode(expiryDate, secret) {
    const payload = encode(dayNumber(expiryDate), 3);
    return `LL-${payload}-${signature(payload, secret)}`;
  }

  function checkCode(code, secret, today = new Date()) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^LL[A-Z0-9]{8}$/.test(clean)) return { ok: false, reason: 'format' };
    const payload = clean.slice(2, 5);
    const sig = clean.slice(5);
    if (Number.isNaN(decode(payload)) || signature(payload, secret) !== sig) return { ok: false, reason: 'invalid' };
    const expires = dateFromDay(decode(payload));
    if (dayNumber(expires) < dayNumber(today)) return { ok: false, reason: 'expired', expires };
    return { ok: true, expires, code: `LL-${payload}-${sig}` };
  }

  /* ------------------------------------------------------------------ */
  /* Formatting helpers shared by both pages                             */
  /* ------------------------------------------------------------------ */

  const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

  function fmtFraction(v) {
    const q = Math.round(v * 4) / 4;
    const whole = Math.floor(q);
    const frac = FRACTIONS[q - whole] || '';
    if (whole === 0) return frac || '0';
    return `${whole}${frac}`;
  }

  function fmtAmount(id, amount) {
    const f = FOODS[id];
    if (f.unit === 'g' || f.unit === 'ml') {
      let hint = '';
      if (f.katori) hint = `≈ ${fmtFraction(amount / f.katori)} katori`;
      if (f.glass) hint = `≈ ${fmtFraction(amount / f.glass)} glass`;
      return { qty: `${amount} ${f.unit}`, hint };
    }
    const label = amount === 1 || amount < 1 ? f.unit : f.units || f.unit;
    return { qty: `${fmtFraction(amount)} ${label}`, hint: '' };
  }

  function fmtDate(d) {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  global.LiftLab = {
    ACTIVITY, GOALS, LIMITS, FOODS, MEALS, DAY_NAMES,
    bmi, bmiCategory, bmiCategoryWHO, bmr, validate, analyse,
    dietPlan, workoutPlan,
    hash, makeCode, checkCode, dayNumber, dateFromDay,
    fmtAmount, fmtFraction, fmtDate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
