-- Track the CalDAV (Nextcloud) event created for a booking so it can be
-- deleted on cancellation and replaced on reschedule.
ALTER TABLE bookings ADD COLUMN caldav_event_uid TEXT;
