/**
 * Seed script — populates the Question Library with reusable questions.
 *
 * Includes all questions from the 3 sample assessment rounds plus
 * additional MCQ and Output Prediction questions ready to import.
 *
 * Usage (from project root):
 *   cp scripts/seed-library.mjs backend/seed-library.mjs
 *   node --env-file=backend/.env backend/seed-library.mjs
 *   rm backend/seed-library.mjs
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function add(entry) {
  const { data, error } = await db.from('library_questions').insert(entry).select().single()
  if (error) throw new Error(`${entry.title}: ${error.message}`)
  return data
}

// ── Output Prediction — from live rounds ─────────────────────────────────────

console.log('\n[Output Prediction] From live assessment rounds...')

const opFromRounds = [
  {
    title:        'Even or Odd',
    description:  'Look at the code below. What will it print to the screen?',
    starter_code: 'n = 7\nif n % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")',
    tags:         ['python', 'basics', 'conditionals'],
  },
  {
    title:        'Print N Natural Numbers',
    description:  'Predict the complete output of this program, one number per line.',
    starter_code: 'n = 5\nfor i in range(1, n + 1):\n    print(i)',
    tags:         ['python', 'basics', 'loops'],
  },
  {
    title:        'String Slicing',
    description:  'What will this program print? Type the output exactly.',
    starter_code: 's = "Hello, World!"\nprint(s[0:5])',
    tags:         ['python', 'strings'],
  },
  {
    title:        'Negative List Index',
    description:  'Predict the output of the program below.',
    starter_code: 'lst = [10, 20, 30, 40, 50]\nprint(lst[-1])',
    tags:         ['python', 'lists'],
  },
  {
    title:        'Integer Division and Modulo',
    description:  'This program prints two values on separate lines. What are they?',
    starter_code: 'x = 17\ny = 5\nprint(x // y)\nprint(x % y)',
    tags:         ['python', 'math', 'operators'],
  },
  {
    title:        'Sum Using a Loop',
    description:  'What does this program print?',
    starter_code: 'total = 0\nfor i in range(1, 6):\n    total += i\nprint(total)',
    tags:         ['python', 'loops', 'math'],
  },
  {
    title:        'Title Case String',
    description:  'Predict the exact output of the code.',
    starter_code: 'name = "python programming"\nprint(name.title())',
    tags:         ['python', 'strings'],
  },
]

for (const q of opFromRounds) {
  await add({ ...q, question_type: 'output_prediction', points: 10 })
  console.log(`  ${q.title}`)
}

// ── MCQ — from live rounds ────────────────────────────────────────────────────

console.log('\n[MCQ] From live assessment rounds...')

const mcqFromRounds = [
  {
    title:       'Binary Search Complexity',
    description: 'What is the time complexity of Binary Search on a sorted array of n elements?',
    tags:        ['cs-fundamentals', 'algorithms'],
    mcq_options: [
      { label:'A', text:'O(n)',     is_correct:false },
      { label:'B', text:'O(log n)', is_correct:true  },
      { label:'C', text:'O(n²)',    is_correct:false },
      { label:'D', text:'O(1)',     is_correct:false },
    ],
  },
  {
    title:       'Python Function Keyword',
    description: 'Which keyword is used to define a function in Python?',
    tags:        ['python', 'syntax'],
    mcq_options: [
      { label:'A', text:'function', is_correct:false },
      { label:'B', text:'def',      is_correct:true  },
      { label:'C', text:'fun',      is_correct:false },
      { label:'D', text:'define',   is_correct:false },
    ],
  },
  {
    title:       'String Length in Python',
    description: "What is the output of this Python expression?\n\nlen(\"Hello\")",
    tags:        ['python', 'strings', 'built-ins'],
    mcq_options: [
      { label:'A', text:'4',     is_correct:false },
      { label:'B', text:'5',     is_correct:true  },
      { label:'C', text:'6',     is_correct:false },
      { label:'D', text:'Error', is_correct:false },
    ],
  },
  {
    title:       'LIFO Data Structure',
    description: 'Which data structure follows the LIFO (Last In, First Out) principle?',
    tags:        ['cs-fundamentals', 'data-structures'],
    mcq_options: [
      { label:'A', text:'Queue',       is_correct:false },
      { label:'B', text:'Array',       is_correct:false },
      { label:'C', text:'Stack',       is_correct:true  },
      { label:'D', text:'Linked List', is_correct:false },
    ],
  },
  {
    title:       'Full Form of HTML',
    description: 'What does HTML stand for?',
    tags:        ['cs-fundamentals', 'web'],
    mcq_options: [
      { label:'A', text:'HyperText Markup Language',        is_correct:true  },
      { label:'B', text:'Home Tool Markup Language',        is_correct:false },
      { label:'C', text:'HyperText Machine Language',       is_correct:false },
      { label:'D', text:'Hyperlink and Text Markup Language', is_correct:false },
    ],
  },
]

for (const q of mcqFromRounds) {
  await add({ ...q, question_type: 'mcq', points: 10 })
  console.log(`  ${q.title}`)
}

// ── Output Prediction — additional ───────────────────────────────────────────

console.log('\n[Output Prediction] Additional questions...')

const opExtra = [
  {
    title:        'FizzBuzz (1 to 15)',
    description:  'A classic! What does this program print?',
    tags:         ['python', 'loops', 'classic'],
    starter_code: 'for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)',
  },
  {
    title:        'Factorial of 5',
    description:  'What will this program print?',
    tags:         ['python', 'loops', 'math'],
    starter_code: 'n = 5\nresult = 1\nfor i in range(1, n + 1):\n    result *= i\nprint(result)',
  },
  {
    title:        'Reverse a String',
    description:  'Predict the output exactly.',
    tags:         ['python', 'strings'],
    starter_code: 's = "hello"\nprint(s[::-1])',
  },
  {
    title:        'List Append and Length',
    description:  'What does this program print?',
    tags:         ['python', 'lists'],
    starter_code: 'nums = [1, 2, 3]\nnums.append(4)\nnums.append(5)\nprint(len(nums))',
  },
  {
    title:        'Fibonacci First 7 Terms',
    description:  'What will this program print? (one number per line)',
    tags:         ['python', 'loops', 'math'],
    starter_code: 'a, b = 0, 1\nfor _ in range(7):\n    print(a)\n    a, b = b, a + b',
  },
  {
    title:        'Count Vowels',
    description:  'What does this program print?',
    tags:         ['python', 'strings', 'loops'],
    starter_code: 'word = "programming"\ncount = 0\nfor ch in word:\n    if ch in "aeiou":\n        count += 1\nprint(count)',
  },
  {
    title:        'Largest in a List',
    description:  'Predict the output of the code.',
    tags:         ['python', 'lists', 'built-ins'],
    starter_code: 'nums = [3, 1, 7, 2, 9, 4]\nprint(max(nums))',
  },
  {
    title:        'String Repetition',
    description:  'What will Python print here?',
    tags:         ['python', 'strings'],
    starter_code: 's = "ha"\nprint(s * 3)',
  },
]

for (const q of opExtra) {
  await add({ ...q, question_type: 'output_prediction', points: 10 })
  console.log(`  ${q.title}`)
}

// ── MCQ — additional ──────────────────────────────────────────────────────────

console.log('\n[MCQ] Additional questions...')

const mcqExtra = [
  {
    title:       'Python Comment Symbol',
    description: 'Which symbol is used to write a single-line comment in Python?',
    tags:        ['python', 'syntax'],
    mcq_options: [
      { label:'A', text:'//',    is_correct:false },
      { label:'B', text:'#',     is_correct:true  },
      { label:'C', text:'/* */', is_correct:false },
      { label:'D', text:'--',    is_correct:false },
    ],
  },
  {
    title:       'First Element Index',
    description: 'What is the index of the first element of an array in most programming languages?',
    tags:        ['arrays', 'basics'],
    mcq_options: [
      { label:'A', text:'1',                    is_correct:false },
      { label:'B', text:'-1',                   is_correct:false },
      { label:'C', text:'0',                    is_correct:true  },
      { label:'D', text:'Depends on language',  is_correct:false },
    ],
  },
  {
    title:       'Full Form of CPU',
    description: 'What does CPU stand for?',
    tags:        ['cs-fundamentals', 'hardware'],
    mcq_options: [
      { label:'A', text:'Central Processing Unit',  is_correct:true  },
      { label:'B', text:'Central Program Utility',  is_correct:false },
      { label:'C', text:'Core Processing Unit',     is_correct:false },
      { label:'D', text:'Computer Processing Unit', is_correct:false },
    ],
  },
  {
    title:       'Python List Syntax',
    description: 'Which of the following correctly defines a list in Python?',
    tags:        ['python', 'data-structures'],
    mcq_options: [
      { label:'A', text:'(1, 2, 3)', is_correct:false },
      { label:'B', text:'{1, 2, 3}', is_correct:false },
      { label:'C', text:'[1, 2, 3]', is_correct:true  },
      { label:'D', text:'<1, 2, 3>', is_correct:false },
    ],
  },
  {
    title:       'OOP Full Form',
    description: 'What does OOP stand for in software development?',
    tags:        ['cs-fundamentals', 'oop'],
    mcq_options: [
      { label:'A', text:'Object Oriented Programming', is_correct:true  },
      { label:'B', text:'Object Operated Protocol',    is_correct:false },
      { label:'C', text:'Optimised Output Program',    is_correct:false },
      { label:'D', text:'Open Object Protocol',        is_correct:false },
    ],
  },
  {
    title:       'Python Built-in Data Types',
    description: 'Which of the following is NOT a built-in Python data type?',
    tags:        ['python', 'data-types'],
    mcq_options: [
      { label:'A', text:'int',   is_correct:false },
      { label:'B', text:'float', is_correct:false },
      { label:'C', text:'char',  is_correct:true  },
      { label:'D', text:'bool',  is_correct:false },
    ],
  },
  {
    title:       'Loop to Print 1 to 10',
    description: 'Which Python loop correctly prints numbers 1 to 10?',
    tags:        ['python', 'loops'],
    mcq_options: [
      { label:'A', text:'for i in range(1, 10): print(i)',  is_correct:false },
      { label:'B', text:'for i in range(10): print(i)',     is_correct:false },
      { label:'C', text:'for i in range(1, 11): print(i)',  is_correct:true  },
      { label:'D', text:'for i in range(0, 10): print(i)',  is_correct:false },
    ],
  },
  {
    title:       'What is a Compiler?',
    description: 'What does a compiler do?',
    tags:        ['cs-fundamentals', 'programming'],
    mcq_options: [
      { label:'A', text:'Executes code line by line',                          is_correct:false },
      { label:'B', text:'Translates high-level code to machine code all at once', is_correct:true  },
      { label:'C', text:'Manages memory allocation only',                      is_correct:false },
      { label:'D', text:'Connects programs to the internet',                   is_correct:false },
    ],
  },
]

for (const q of mcqExtra) {
  await add({ ...q, question_type: 'mcq', points: 10 })
  console.log(`  ${q.title}`)
}

const { count } = await db.from('library_questions').select('*', { count: 'exact', head: true })
console.log(`\nLibrary total: ${count} questions`)
