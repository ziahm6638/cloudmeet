-- Who the attendee works for.
--
-- The booking form only ever asked for a name and an email address, which is
-- not enough to tell whose booking this is. One prospect booked three times
-- from adwaith.k@addexpropities.com, adwaith.k@addex.com and
-- adwaith.k@addexproperties.com while the CRM held adwaithk1304@gmail.com for
-- him, so an address is not an identity. Free providers make it worse: a sole
-- trader booking from gmail.com carries no domain to reason about at all.
--
-- Asking the attendee is cheaper and more reliable than inferring it later.

ALTER TABLE bookings ADD COLUMN attendee_company TEXT;
