// Mock data for Manhattan Quiet Place Finder
// Manhattan 安静地点查找器的模拟数据

import { QuietPlace, UserProfile, ChatMessage } from '@/types/quietPlace';

// Realistic Manhattan coordinates / 曼哈顿的真实坐标
export const MANHATTAN_CENTER = {
  lat: 40.7831,
  lng: -73.9712,
};

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
