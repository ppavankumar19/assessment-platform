/**
 * Seed script — creates 3 sample assessment rounds with questions.
 *
 * Usage (from project root):
 *   node --env-file=backend/.env --experimental-vm-modules scripts/seed-sample-data.mjs
 *
 * Or (simpler — copy into backend/ dir where node_modules live):
 *   cp scripts/seed-sample-data.mjs backend/seed.mjs
 *   node --env-file=backend/.env backend/seed.mjs
 *   rm backend/seed.mjs
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function insert(table, data) {
  const { data: row, error } = await db.from(table).insert(data).select().single()
  if (error) throw new Error(`${table}: ${error.message}`)
  return row
}

async function insertMany(table, rows) {
  const { error } = await db.from(table).insert(rows)
  if (error) throw new Error(`${table}: ${error.message}`)
}

// ── Round 1: Python Basics (Output Prediction, 2 questions) ──────────────────

const r1 = await insert('rounds', {
  title:            'Python Basics',
  description:      'Read the Python code and predict what it will print. Two easy programs to warm up.',
  round_type:       'output_prediction',
  duration_minutes: 30,
  cutoff_score:     10,
  is_published:     true,
  is_active:        true,
})
console.log(`[1] Created: ${r1.title}`)

const q1 = await insert('questions', {
  round_id:      r1.id,
  title:         'Even or Odd',
  description:   'Look at the code below. What will it print to the screen?',
  question_type: 'output_prediction',
  points:        10,
  order_index:   1,
  starter_code:  'n = 7\nif n % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")',
})
await insertMany('test_cases', [
  { question_id: q1.id, input: '', expected_output: 'Odd', is_hidden: false, points: 10, order_index: 1 },
])
console.log(`    Q1: ${q1.title}`)

const q2 = await insert('questions', {
  round_id:      r1.id,
  title:         'Print N Natural Numbers',
  description:   'Predict the complete output of this program, one number per line.',
  question_type: 'output_prediction',
  points:        10,
  order_index:   2,
  starter_code:  'n = 5\nfor i in range(1, n + 1):\n    print(i)',
})
await insertMany('test_cases', [
  { question_id: q2.id, input: '', expected_output: '1\n2\n3\n4\n5', is_hidden: false, points: 10, order_index: 1 },
])
console.log(`    Q2: ${q2.title}`)

// ── Round 2: CS Fundamentals MCQ (5 questions) ───────────────────────────────

const r2 = await insert('rounds', {
  title:            'CS Fundamentals MCQ',
  description:      'Test your knowledge of core computer science concepts. Pick the best answer.',
  round_type:       'mcq',
  duration_minutes: 20,
  cutoff_score:     30,
  is_published:     true,
  is_active:        true,
})
console.log(`[2] Created: ${r2.title}`)

const mcqs = [
  {
    title:       'Binary Search Complexity',
    description: 'What is the time complexity of Binary Search on a sorted array of n elements?',
    order_index: 1,
    mcq_options: [
      { label: 'A', text: 'O(n)',     is_correct: false },
      { label: 'B', text: 'O(log n)', is_correct: true  },
      { label: 'C', text: 'O(n²)',    is_correct: false },
      { label: 'D', text: 'O(1)',     is_correct: false },
    ],
  },
  {
    title:       'Python Function Keyword',
    description: 'Which keyword is used to define a function in Python?',
    order_index: 2,
    mcq_options: [
      { label: 'A', text: 'function', is_correct: false },
      { label: 'B', text: 'def',      is_correct: true  },
      { label: 'C', text: 'fun',      is_correct: false },
      { label: 'D', text: 'define',   is_correct: false },
    ],
  },
  {
    title:       'String Length in Python',
    description: 'What is the output of this Python expression?\n\nlen("Hello")',
    order_index: 3,
    mcq_options: [
      { label: 'A', text: '4',     is_correct: false },
      { label: 'B', text: '5',     is_correct: true  },
      { label: 'C', text: '6',     is_correct: false },
      { label: 'D', text: 'Error', is_correct: false },
    ],
  },
  {
    title:       'LIFO Data Structure',
    description: 'Which data structure follows the LIFO (Last In, First Out) principle?',
    order_index: 4,
    mcq_options: [
      { label: 'A', text: 'Queue',       is_correct: false },
      { label: 'B', text: 'Array',       is_correct: false },
      { label: 'C', text: 'Stack',       is_correct: true  },
      { label: 'D', text: 'Linked List', is_correct: false },
    ],
  },
  {
    title:       'Full Form of HTML',
    description: 'What does HTML stand for?',
    order_index: 5,
    mcq_options: [
      { label: 'A', text: 'HyperText Markup Language',        is_correct: true  },
      { label: 'B', text: 'Home Tool Markup Language',        is_correct: false },
      { label: 'C', text: 'HyperText Machine Language',       is_correct: false },
      { label: 'D', text: 'Hyperlink and Text Markup Language', is_correct: false },
    ],
  },
]

for (const q of mcqs) {
  const row = await insert('questions', {
    round_id:      r2.id,
    question_type: 'mcq',
    points:        10,
    ...q,
  })
  console.log(`    ${q.order_index}. ${row.title}`)
}

// ── Round 3: Code Output Challenge (Output Prediction, 5 questions) ───────────

const r3 = await insert('rounds', {
  title:            'Code Output Challenge',
  description:      'Read each Python snippet carefully. Type exactly what the program will print, including spacing and line breaks.',
  round_type:       'output_prediction',
  duration_minutes: 45,
  cutoff_score:     25,
  is_published:     true,
  is_active:        true,
})
console.log(`[3] Created: ${r3.title}`)

const ops = [
  {
    title:        'String Slicing',
    description:  'What will this program print? Type the output exactly.',
    order_index:  1,
    starter_code: 's = "Hello, World!"\nprint(s[0:5])',
    expected:     'Hello',
  },
  {
    title:        'Negative List Index',
    description:  'Predict the output of the program below.',
    order_index:  2,
    starter_code: 'lst = [10, 20, 30, 40, 50]\nprint(lst[-1])',
    expected:     '50',
  },
  {
    title:        'Integer Division and Modulo',
    description:  'This program prints two values on separate lines. What are they?',
    order_index:  3,
    starter_code: 'x = 17\ny = 5\nprint(x // y)\nprint(x % y)',
    expected:     '3\n2',
  },
  {
    title:        'Sum Using a Loop',
    description:  'What does this program print?',
    order_index:  4,
    starter_code: 'total = 0\nfor i in range(1, 6):\n    total += i\nprint(total)',
    expected:     '15',
  },
  {
    title:        'Title Case String',
    description:  'Predict the exact output of the code.',
    order_index:  5,
    starter_code: 'name = "python programming"\nprint(name.title())',
    expected:     'Python Programming',
  },
]

for (const q of ops) {
  const { expected, ...qData } = q
  const row = await insert('questions', {
    round_id:      r3.id,
    question_type: 'output_prediction',
    points:        10,
    ...qData,
  })
  await insertMany('test_cases', [
    { question_id: row.id, input: '', expected_output: expected, is_hidden: false, points: 10, order_index: 1 },
  ])
  console.log(`    ${q.order_index}. ${row.title}`)
}

// ── Round 4: Coding Challenge (write Python or C) ─────────────────────────────

const r4 = await insert('rounds', {
  title:            'Coding Challenge',
  description:      'Write a working program to solve each problem. You may use Python 3 or C — your choice! Read the sample test cases, then make sure your code handles all inputs correctly.',
  round_type:       'coding',
  duration_minutes: 60,
  cutoff_score:     20,
  is_published:     true,
  is_active:        true,
})
console.log(`[4] Created: ${r4.title}`)

const codingProblems = [
  {
    title:        'Sum of Two Numbers',
    description:  'Read two integers from input (one per line). Print their sum.',
    order_index:  1,
    language:     'any',
    starter_code: '# Python starter\na = int(input())\nb = int(input())\nprint(a + b)',
    cases: [
      { input: '3\n5',     expected_output: '8',   is_hidden: false, points: 5 },
      { input: '10\n20',   expected_output: '30',  is_hidden: false, points: 5 },
      { input: '0\n0',     expected_output: '0',   is_hidden: true,  points: 10 },
      { input: '100\n200', expected_output: '300', is_hidden: true,  points: 10 },
    ],
  },
  {
    title:        'Odd or Even',
    description:  'Read an integer N. If N is odd, print "Odd". If N is even, print "Even".',
    order_index:  2,
    language:     'any',
    starter_code: '# Python starter\nn = int(input())\n# print Odd or Even',
    cases: [
      { input: '7',  expected_output: 'Odd',  is_hidden: false, points: 5 },
      { input: '12', expected_output: 'Even', is_hidden: false, points: 5 },
      { input: '0',  expected_output: 'Even', is_hidden: true,  points: 10 },
      { input: '99', expected_output: 'Odd',  is_hidden: true,  points: 10 },
    ],
  },
  {
    title:        'Sum of First N Natural Numbers',
    description:  'Read a positive integer N. Print the sum of all integers from 1 to N (inclusive).',
    order_index:  3,
    language:     'any',
    starter_code: '# Python starter\nn = int(input())\n# compute and print the sum',
    cases: [
      { input: '5',   expected_output: '15',   is_hidden: false, points: 5 },
      { input: '10',  expected_output: '55',   is_hidden: false, points: 5 },
      { input: '1',   expected_output: '1',    is_hidden: true,  points: 10 },
      { input: '100', expected_output: '5050', is_hidden: true,  points: 10 },
    ],
  },
]

for (const { cases, ...qData } of codingProblems) {
  const row = await insert('questions', {
    round_id:      r4.id,
    question_type: 'coding',
    points:        30,
    ...qData,
  })
  await insertMany('test_cases', cases.map((c, i) => ({
    question_id:     row.id,
    input:           c.input,
    expected_output: c.expected_output,
    is_hidden:       c.is_hidden,
    points:          c.points,
    order_index:     i + 1,
  })))
  console.log(`    ${qData.order_index}. ${row.title}`)
}

console.log('\nSeed complete.')
console.log(`Python Basics      → /test/entry.html?round=${r1.id}`)
console.log(`CS Fundamentals    → /test/entry.html?round=${r2.id}`)
console.log(`Code Output Chall. → /test/entry.html?round=${r3.id}`)
console.log(`Coding Challenge   → /test/entry.html?round=${r4.id}`)
