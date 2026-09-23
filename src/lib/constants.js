export const OPPORTUNITY_TYPES = [
  "Catering inquiry",
  "Private event inquiry",
  "Reservation inquiry",
  "General customer inquiry",
  "Unanswered inquiry",
  "Follow-up opportunity",
  "Customer reactivation",
];

export const OPPORTUNITY_STATUS = {
  NEEDS_REVIEW: "Needs Review",
  NEEDS_RESPONSE: "Needs Response",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DISMISSED: "Dismissed",
};

export const OPPORTUNITY_STATUS_LIST = [
  "Needs Review",
  "Needs Response",
  "In Progress",
  "Completed",
  "Dismissed",
];

export const PRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const PRIORITY_LIST = ["high", "medium", "low"];

export const CONVERSATION_STATUS = {
  NEW: "New",
  NEEDS_ATTENTION: "Needs Attention",
  RESPONDED: "Responded",
  CLOSED: "Closed",
};

export const CONVERSATION_STATUS_LIST = ["New", "Needs Attention", "Responded", "Closed"];

export const ACTION_STATUS = {
  PENDING: "Pending Approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  DISMISSED: "Dismissed",
};

export const ACTION_STATUS_LIST = ["Pending Approval", "Approved", "Completed", "Dismissed"];

export const ACTION_TYPES = [
  "Draft response",
  "Follow-up reminder",
  "Customer follow-up",
  "Opportunity review",
];

export const SOURCES = [
  "Email",
  "Website form",
  "Phone",
  "Google Business Profile",
  "Instagram",
  "Facebook",
  "SMS",
  "In-person",
];

export const RESTAURANT_TYPES = [
  "Fine dining",
  "Casual dining",
  "Fast casual",
  "Cafe",
  "Bistro",
  "Bar & Grill",
  "Pizzeria",
  "Bakery",
  "Other",
];

export const EMPLOYEE_RANGES = [
  "1-5",
  "6-10",
  "11-20",
  "21-50",
  "50+",
];

export const INQUIRY_RANGES = [
  "Less than 50",
  "50-100",
  "100-200",
  "200-500",
  "500+",
];

export const NAV_ITEMS = [
  { label: "Today", path: "/today", icon: "Sun" },
  { label: "Opportunities", path: "/opportunities", icon: "Target" },
  { label: "Inbox", path: "/inbox", icon: "Inbox" },
  { label: "Actions", path: "/actions", icon: "CheckSquare" },
  { label: "Settings", path: "/settings", icon: "Settings" },
];