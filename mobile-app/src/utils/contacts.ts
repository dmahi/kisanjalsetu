import { Contacts } from '@capacitor-community/contacts';
import { triggerHaptic } from './haptics';

export interface SelectedContact {
  name?: string;
  phone?: string;
}

/**
 * Pick a contact phone number directly from device phonebook
 */
export async function pickPhoneContact(): Promise<SelectedContact | null> {
  void triggerHaptic('medium');
  try {
    const permission = await Contacts.checkPermissions();
    if (permission.contacts !== 'granted') {
      const requested = await Contacts.requestPermissions();
      if (requested.contacts !== 'granted') {
        throw new Error('Permission denied');
      }
    }

    const res = await Contacts.pickContact({
      projection: {
        name: true,
        phones: true,
      },
    });

    if (res?.contact) {
      const rawPhone = res.contact.phones?.[0]?.number || '';
      const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
      const contactName = res.contact.name?.display || res.contact.name?.given || '';
      return {
        name: contactName,
        phone: cleanPhone,
      };
    }
  } catch {
    /* Fallback to Browser Contact Picker API if supported */
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = ['name', 'tel'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts?.[0]) {
          const c = contacts[0];
          const rawPhone = c.tel?.[0] || '';
          return {
            name: c.name?.[0] || '',
            phone: rawPhone.replace(/[^0-9+]/g, ''),
          };
        }
      } catch {
        /* User cancelled or unsupported */
      }
    }
  }
  return null;
}
