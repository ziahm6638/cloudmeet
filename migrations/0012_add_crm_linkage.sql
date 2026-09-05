-- Which CRM record this booking belongs to.
--
-- Matching a booking back to the CRM by email address does not work. Of the
-- four real bookings on the register when this was written, exactly one could
-- be matched by address: the others used a work address the CRM had never seen,
-- or a free provider with no domain to reason about. So the CRM states who it
-- means rather than leaving it to be inferred afterwards.
--
-- Only a caller holding CRM_API_SECRET may set these. A booking made from the
-- public page carries nulls and is reconciled at the CRM end.

ALTER TABLE bookings ADD COLUMN crm_company_id TEXT;
ALTER TABLE bookings ADD COLUMN crm_contact_id TEXT;
ALTER TABLE bookings ADD COLUMN crm_deal_id TEXT;
ALTER TABLE bookings ADD COLUMN booked_by TEXT
  CHECK (booked_by IN ('rep', 'self_serve')) DEFAULT 'self_serve';

CREATE INDEX IF NOT EXISTS idx_bookings_crm_company ON bookings(crm_company_id);
