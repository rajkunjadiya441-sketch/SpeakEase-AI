export const TARGET_TYPES = {
  SOUND: 'SOUND',
  SYLLABLE: 'SYLLABLE',
  WORD: 'WORD',
  PHRASE: 'PHRASE',
  SENTENCE: 'SENTENCE',
  EVERYDAY_USE: 'EVERYDAY USE',
};

export const TARGET_TYPE_DETAILS = {
  [TARGET_TYPES.SOUND]: {
    label: 'Speech Sound (Phoneme)',
    badge: 'Sound',
    description: 'Specific phonetic articulation target (e.g. /ʃ/, /θ/, /r/, /s/)',
    examplePrompt: 'e.g., /ʃ/ as in "ship"',
    defaultProgression: ['Sound', 'Syllable', 'Word', 'Phrase', 'Sentence', 'Everyday use'],
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  [TARGET_TYPES.SYLLABLE]: {
    label: 'Syllable Combination',
    badge: 'Syllable',
    description: 'Target consonant-vowel combinations (e.g. sha, she, sho, tha)',
    examplePrompt: 'e.g., sha, she, sho',
    defaultProgression: ['Syllable', 'Word', 'Phrase', 'Sentence', 'Everyday use'],
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  [TARGET_TYPES.WORD]: {
    label: 'Single Word',
    badge: 'Word',
    description: 'Individual lexical target containing focus phonemes (e.g. ship, three, rabbit)',
    examplePrompt: 'e.g., ship, rabbit, school',
    defaultProgression: ['Word', 'Phrase', 'Sentence', 'Everyday use'],
    color: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  [TARGET_TYPES.PHRASE]: {
    label: 'Short Phrase',
    badge: 'Phrase',
    description: 'Multi-word syntactic grouping (e.g. "three apples", "red ribbon")',
    examplePrompt: 'e.g., three apples',
    defaultProgression: ['Phrase', 'Sentence', 'Everyday use'],
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  [TARGET_TYPES.SENTENCE]: {
    label: 'Full Sentence',
    badge: 'Sentence',
    description: 'Complete expressive sentence (e.g. "I have three red apples.")',
    examplePrompt: 'e.g., I have three red apples.',
    defaultProgression: ['Sentence', 'Everyday conversation'],
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  [TARGET_TYPES.EVERYDAY_USE]: {
    label: 'Everyday Functional Use',
    badge: 'Everyday Use',
    description: 'Contextual communication for real-world interactions (e.g. ordering coffee, asking directions)',
    examplePrompt: 'e.g., Ordering food at a counter',
    defaultProgression: ['Everyday conversation'],
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const PRACTICE_LEVELS = [
  'Sound Isolation',
  'Syllable Repetition',
  'Single Word Practice',
  'Short Phrase Context',
  'Full Sentence Fluency',
  'Everyday Conversation',
];

export const EXERCISE_TYPES = [
  { id: 'REPETITION', name: 'Direct Repetition', desc: 'Listen and repeat the focus target with clear articulation' },
  { id: 'MINIMAL_PAIRS', name: 'Minimal Contrast Pairs', desc: 'Distinguish between phonologically similar target words' },
  { id: 'FILL_IN_BLANK', name: 'Contextual Cue', desc: 'Speak the target within a structured contextual prompt' },
  { id: 'ROLE_PLAY', name: 'Functional Dialogue', desc: 'Conversational turn-taking practicing target expression' },
];
