// Type definitions for Quiet Place Finder
// 安静地点查找器的类型定义

/**
 * Represents a review left by a user
 * 用户留下的评价
 */
export interface PlaceReview {
  author: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

/**
 * Represents a quiet place in Manhattan
 * 表示曼哈顿的一个安静地点
 */
export interface QuietPlace {
  id: string;
  name: string;
  address: string;
  zipCode: string;
  type: PlaceType;
  // Geographic coordinates / 地理坐标
  lat: number;
  lng: number;
  // Quiet score 0-100 / 安静评分 0-100
  quietScore: number;
  // Distance from search center in km / 距离搜索中心多少公里
  distance: number;
  // Current occupancy / 当前 occupancy
  currentPeople: number;
  totalCapacity: number;
  // Crowdedness level / 拥挤程度
  crowdedness: 'low' | 'medium' | 'high';
  // Future predictions / 未来预测
  predictions: ScorePrediction[];
  // Status / 状态
  isOpen: boolean;
  // Photo URLs for carousel / 照片轮播 URL
  photos?: string[];
  // Opening hours / 开放时间
  hours: string;
  // Tags / 标签
  tags: string[];
  // User reviews / 用户评价
  reviews: PlaceReview[];
}

/**
 * Types of quiet places
 * 安静地点的类型
 */
export type PlaceType = 'Cafe' | 'Library' | 'Coworking Space' | 'Public Study Area';

/**
 * Quiet score prediction for a future time slot
 * 未来时间段的安静分数预测
 */
export interface ScorePrediction {
  time: string; // e.g. "2 PM" / 例如 "下午2点"
  quietScore: number; // 0-100
}

/**
 * Filter options for searching quiet places
 * 搜索安静地点的过滤选项
 */
export interface FilterOptions {
  types: PlaceType[];
  minQuietScore: number;
  sortBy: 'distance' | 'quietScore';
}

/**
 * User profile data
 * 用户资料数据
 */
export interface UserProfile {
  username: string;
  avatar: string;
  favorites: QuietPlace[];
  savedPlaces: QuietPlace[];
}

/**
 * Chat message in AI chat window
 * AI 聊天窗口中的消息
 */
export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}
