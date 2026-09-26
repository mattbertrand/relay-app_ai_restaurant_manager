// Frontend presentation labels for email categories and inbox statuses.

export const CATEGORY_LABELS = {
  catering: "Catering",
  private_event: "Private Event",
  reservation: "Reservation",
  reservation_issue: "Reservation Issue",
  customer_service: "Customer Service",
  general_customer_inquiry: "Customer Inquiry",
  high_value_business: "Business Inquiry",
  partnership: "Partnership",
  job_application: "Job Application",
  vendor: "Vendor",
  billing_administrative: "Billing / Administrative",
  general_administrative: "Administrative",
  general_information: "General Information",
  automated_notification: "Automated Notification",
  non_actionable: "No Actionable Intent",
  spam: "Spam",
  newsletter: "Newsletter",
  irrelevant_promotional: "Promotional Email",
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || "";
}

// Inbox message lifecycle — separate from the opportunity lifecycle
// (New → In Progress → Resolved) on the Opportunities dashboard.
export const INBOX_STATUSES = ["New", "Reviewed", "Archived"];