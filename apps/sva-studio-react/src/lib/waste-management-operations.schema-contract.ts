const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const requiredWasteTables = [
  'waste_regions',
  'waste_cities',
  'waste_streets',
  'waste_house_numbers',
  'waste_collection_locations',
  'waste_fractions',
  'waste_custom_recurrence_presets',
  'waste_tours',
  'waste_location_tour_links',
  'waste_location_tour_pickup_dates',
  'waste_tour_assignments',
  'waste_tour_assignment_locations',
  'waste_email_reminder_subscriptions',
  'waste_email_reminder_subscription_items',
  'waste_email_reminder_outbox',
  'waste_tour_date_shifts',
  'waste_global_date_shifts',
  'waste_holiday_rules',
  'waste_settings',
] as const;

export const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};
