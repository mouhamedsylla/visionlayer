-- Chaque changement d'état d'une réservation est copié dans audit_log.
CREATE OR REPLACE FUNCTION audit_bookings() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_log (entity, entity_id, change)
    VALUES ('booking', NEW.id, jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_bookings AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION audit_bookings();
