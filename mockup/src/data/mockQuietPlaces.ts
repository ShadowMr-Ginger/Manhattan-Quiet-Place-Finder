// Mock data for Manhattan Quiet Place Finder
// Manhattan 安静地点查找器的模拟数据

import { QuietPlace, UserProfile, ChatMessage } from '@/types/quietPlace';

// Realistic Manhattan coordinates / 曼哈顿的真实坐标
export const MANHATTAN_CENTER = {
  lat: 40.7831,
  lng: -73.9712,
};

// Unsplash photo collections for place types
// 按地点类型的 Unsplash 照片集合
const photoSets: Record<string, string[]> = {
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  ],
  library: [
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80',
    'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80',
  ],
  coworking: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80',
  ],
  public: [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    'https://images.unsplash.com/photo-1519331379826-fbf3350e8b6f?w=800&q=80',
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  ],
};

// Common tags by type
// 按类型的常见标签
const tagSets: Record<string, string[]> = {
  Cafe: ['WiFi Stable', 'Power Outlets', 'Good Coffee', 'Natural Light', 'Cozy Vibe', 'Study Friendly', 'Soft Music'],
  Library: ['Silent Zone', 'Free WiFi', 'Reading Rooms', 'Historic Building', 'Spacious', 'Well Heated', 'Research Access'],
  'Coworking Space': ['Meeting Rooms', 'Standing Desks', 'Free Coffee', 'Printer Access', '24/7', 'Networking', 'Phone Booths'],
  'Public Study Area': ['Free Entry', 'Outdoor Seating', 'People Watching', 'Fresh Air', 'Scenic View', 'Pet Friendly'],
};

// Mock reviews generator
// 模拟评价生成器
function makeReviews(placeType: string, baseScore: number): QuietPlace['reviews'] {
  const reviewers = ['Sarah M.', 'David K.', 'Jessica L.', 'Michael T.', 'Emily R.', 'Chris W.'];
  const cafeComments = [
    'Perfect spot for focused work. The espresso is top-notch!',
    'Great atmosphere, but gets noisy after 4 PM.',
    'Love the natural lighting here. My go-to coding spot.',
    'WiFi is fast and reliable. Plenty of outlets near the window.',
  ];
  const libraryComments = [
    'Incredibly quiet. I get more done here than anywhere else.',
    'Beautiful architecture and very comfortable seating.',
    'The reading room on the 3rd floor is a hidden gem.',
    'Free WiFi and plenty of desk space. Highly recommend.',
  ];
  const coworkingComments = [
    'Great amenities and the community is very friendly.',
    'Phone booths are a lifesaver for Zoom calls.',
    'Standing desks help me stay productive all day.',
    'The free coffee keeps me going through deadlines.',
  ];
  const publicComments = [
    'Nice spot when the weather is good. Can get windy though.',
    'Love studying outdoors here. Very refreshing.',
    'Great for reading, but bring sunscreen in summer.',
    'Peaceful corner away from the main path.',
  ];

  const commentPool =
    placeType === 'Cafe' ? cafeComments :
    placeType === 'Library' ? libraryComments :
    placeType === 'Coworking Space' ? coworkingComments :
    publicComments;

  return commentPool.slice(0, 3).map((comment, i) => ({
    author: reviewers[i % reviewers.length],
    rating: Math.min(5, Math.max(3, Math.round(baseScore / 20) + (i % 2 === 0 ? 1 : 0))),
    comment,
    date: `${Math.max(1, 14 - i * 3)} days ago`,
  }));
}

/**
 * Mock quiet places data
 * 模拟的安静地点数据
 */
export const mockQuietPlaces: QuietPlace[] = [
  {
    id: '1',
    name: 'The Reading Room Café',
    address: '245 E 44th St',
    zipCode: '10017',
    type: 'Cafe',
    lat: 40.7529,
    lng: -73.9736,
    quietScore: 88,
    distance: 0.3,
    currentPeople: 12,
    totalCapacity: 40,
    crowdedness: 'low',
    isOpen: true,
    hours: '7:00 AM - 8:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 88 },
      { time: '3 PM', quietScore: 82 },
      { time: '4 PM', quietScore: 75 },
      { time: '5 PM', quietScore: 68 },
      { time: '6 PM', quietScore: 72 },
    ],
    photos: photoSets.cafe,
    tags: tagSets.Cafe.slice(0, 5),
    reviews: makeReviews('Cafe', 88),
  },
  {
    id: '2',
    name: 'New York Public Library - Mid-Manhattan',
    address: '476 5th Ave',
    zipCode: '10018',
    type: 'Library',
    lat: 40.7532,
    lng: -73.9822,
    quietScore: 95,
    distance: 0.8,
    currentPeople: 45,
    totalCapacity: 200,
    crowdedness: 'low',
    isOpen: true,
    hours: '9:00 AM - 6:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 95 },
      { time: '3 PM', quietScore: 93 },
      { time: '4 PM', quietScore: 90 },
      { time: '5 PM', quietScore: 88 },
      { time: '6 PM', quietScore: 85 },
    ],
    photos: photoSets.library,
    tags: tagSets.Library.slice(0, 5),
    reviews: makeReviews('Library', 95),
  },
  {
    id: '3',
    name: 'WeWork Times Square',
    address: '1460 Broadway',
    zipCode: '10036',
    type: 'Coworking Space',
    lat: 40.7580,
    lng: -73.9855,
    quietScore: 72,
    distance: 1.2,
    currentPeople: 89,
    totalCapacity: 150,
    crowdedness: 'medium',
    isOpen: true,
    hours: '8:00 AM - 8:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 72 },
      { time: '3 PM', quietScore: 70 },
      { time: '4 PM', quietScore: 68 },
      { time: '5 PM', quietScore: 65 },
      { time: '6 PM', quietScore: 60 },
    ],
    photos: photoSets.coworking,
    tags: tagSets['Coworking Space'].slice(0, 5),
    reviews: makeReviews('Coworking Space', 72),
  },
  {
    id: '4',
    name: 'Bryant Park Reading Room',
    address: '42 W 42nd St',
    zipCode: '10036',
    type: 'Public Study Area',
    lat: 40.7536,
    lng: -73.9832,
    quietScore: 78,
    distance: 0.6,
    currentPeople: 23,
    totalCapacity: 60,
    crowdedness: 'low',
    isOpen: true,
    hours: '8:00 AM - 6:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 78 },
      { time: '3 PM', quietScore: 75 },
      { time: '4 PM', quietScore: 70 },
      { time: '5 PM', quietScore: 65 },
      { time: '6 PM', quietScore: 62 },
    ],
    photos: photoSets.public,
    tags: tagSets['Public Study Area'].slice(0, 5),
    reviews: makeReviews('Public Study Area', 78),
  },
  {
    id: '5',
    name: 'Devocion Coffee',
    address: '25 E 20th St',
    zipCode: '10003',
    type: 'Cafe',
    lat: 40.7395,
    lng: -73.9890,
    quietScore: 85,
    distance: 1.5,
    currentPeople: 18,
    totalCapacity: 35,
    crowdedness: 'medium',
    isOpen: true,
    hours: '7:30 AM - 6:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 85 },
      { time: '3 PM', quietScore: 80 },
      { time: '4 PM', quietScore: 72 },
      { time: '5 PM', quietScore: 68 },
      { time: '6 PM', quietScore: 75 },
    ],
    photos: photoSets.cafe,
    tags: tagSets.Cafe.slice(2, 7),
    reviews: makeReviews('Cafe', 85),
  },
  {
    id: '6',
    name: 'Stavros Niarchos Foundation Library',
    address: '455 5th Ave',
    zipCode: '10016',
    type: 'Library',
    lat: 40.7517,
    lng: -73.9817,
    quietScore: 92,
    distance: 0.7,
    currentPeople: 67,
    totalCapacity: 180,
    crowdedness: 'medium',
    isOpen: true,
    hours: '9:00 AM - 8:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 92 },
      { time: '3 PM', quietScore: 90 },
      { time: '4 PM', quietScore: 88 },
      { time: '5 PM', quietScore: 85 },
      { time: '6 PM', quietScore: 80 },
    ],
    photos: photoSets.library,
    tags: tagSets.Library.slice(1, 6),
    reviews: makeReviews('Library', 92),
  },
  {
    id: '7',
    name: 'Industrious Grand Central',
    address: '335 Madison Ave',
    zipCode: '10017',
    type: 'Coworking Space',
    lat: 40.7530,
    lng: -73.9780,
    quietScore: 80,
    distance: 0.4,
    currentPeople: 55,
    totalCapacity: 120,
    crowdedness: 'medium',
    isOpen: true,
    hours: '8:00 AM - 6:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 80 },
      { time: '3 PM', quietScore: 78 },
      { time: '4 PM', quietScore: 75 },
      { time: '5 PM', quietScore: 70 },
      { time: '6 PM', quietScore: 65 },
    ],
    photos: photoSets.coworking,
    tags: tagSets['Coworking Space'].slice(0, 5),
    reviews: makeReviews('Coworking Space', 80),
  },
  {
    id: '8',
    name: 'Washington Square Park Quiet Corner',
    address: '1 Washington Square N',
    zipCode: '10003',
    type: 'Public Study Area',
    lat: 40.7308,
    lng: -73.9973,
    quietScore: 65,
    distance: 2.1,
    currentPeople: 8,
    totalCapacity: 25,
    crowdedness: 'low',
    isOpen: true,
    hours: '6:00 AM - 10:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 65 },
      { time: '3 PM', quietScore: 62 },
      { time: '4 PM', quietScore: 58 },
      { time: '5 PM', quietScore: 55 },
      { time: '6 PM', quietScore: 60 },
    ],
    photos: photoSets.public,
    tags: tagSets['Public Study Area'].slice(0, 5),
    reviews: makeReviews('Public Study Area', 65),
  },
  {
    id: '9',
    name: 'Blue Bottle Coffee - Rockefeller',
    address: '1 Rockefeller Plaza',
    zipCode: '10020',
    type: 'Cafe',
    lat: 40.7587,
    lng: -73.9782,
    quietScore: 82,
    distance: 0.9,
    currentPeople: 15,
    totalCapacity: 30,
    crowdedness: 'low',
    isOpen: true,
    hours: '7:00 AM - 7:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 82 },
      { time: '3 PM', quietScore: 78 },
      { time: '4 PM', quietScore: 70 },
      { time: '5 PM', quietScore: 65 },
      { time: '6 PM', quietScore: 72 },
    ],
    photos: photoSets.cafe,
    tags: tagSets.Cafe.slice(1, 6),
    reviews: makeReviews('Cafe', 82),
  },
  {
    id: '10',
    name: 'The Yard: Lower East Side',
    address: '85 Delancey St',
    zipCode: '10002',
    type: 'Coworking Space',
    lat: 40.7185,
    lng: -73.9880,
    quietScore: 76,
    distance: 2.4,
    currentPeople: 42,
    totalCapacity: 100,
    crowdedness: 'medium',
    isOpen: true,
    hours: '9:00 AM - 7:00 PM',
    predictions: [
      { time: '2 PM', quietScore: 76 },
      { time: '3 PM', quietScore: 74 },
      { time: '4 PM', quietScore: 72 },
      { time: '5 PM', quietScore: 68 },
      { time: '6 PM', quietScore: 65 },
    ],
    photos: photoSets.coworking,
    tags: tagSets['Coworking Space'].slice(2, 7),
    reviews: makeReviews('Coworking Space', 76),
  },
];

/**
 * Random AI greeting messages
 * 随机的 AI 问候语
 */
export const aiGreetings = [
  "Looking for a quiet coding spot today?",
  "Need a peaceful study environment?",
  "I can help you find the perfect focus space.",
  "Ready to discover Manhattan's hidden quiet gems?",
  "Searching for a distraction-free workspace?",
  "Let me help you escape the city noise.",
];

/**
 * Mock user profile
 * 模拟用户资料
 */
export const mockUserProfile: UserProfile = {
  username: 'Alex Chen',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  favorites: [mockQuietPlaces[0], mockQuietPlaces[4]],
  savedPlaces: [mockQuietPlaces[1], mockQuietPlaces[5]],
};

/**
 * Generate mock chat messages
 * 生成模拟聊天消息
 */
export const generateMockChatHistory = (): ChatMessage[] => [
  {
    id: '1',
    role: 'assistant',
    content: aiGreetings[Math.floor(Math.random() * aiGreetings.length)],
    timestamp: new Date(),
  },
];

/**
 * Mock AI responses for user messages
 * 模拟 AI 对用户消息的回复
 */
export const mockAIResponses: Record<string, string> = {
  default: "I can help you find quiet places in Manhattan. Try searching for a specific area or using the filters on the left!",
  cafe: "Based on your interest in cafes, I recommend 'The Reading Room Café' with a quiet score of 88, or 'Devocion Coffee' for a cozy atmosphere.",
  library: "Libraries are the best for deep focus! The New York Public Library has a quiet score of 95, and Stavros Niarchos Foundation Library is also excellent.",
  coworking: "For coworking spaces, WeWork Times Square and Industrious Grand Central are popular choices with good amenities.",
  quiet: "The quietest place near you right now is the New York Public Library - Mid-Manhattan with a score of 95.",
};
