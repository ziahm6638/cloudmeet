// Email template exports
export { generateBookingEmail, generateBookingEmailText } from './confirmation';
export { generateCancellationEmail, generateAdminCancellationEmail } from './cancellation';
export { generateRescheduleEmail, generateAdminRescheduleEmail } from './reschedule';
export { generateReminderEmail, generateReminderText, getDefaultReminderSubject } from './reminder';
export { generateAdminNotificationEmail } from './admin-notification';
