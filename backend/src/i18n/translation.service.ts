export type Locale = 'en' | 'hi' | 'pa';

interface TranslationParams {
  [key: string]: string | number;
}

const messages: Record<Locale, Record<string, string>> = {
  en: {
    water_turn_alert_body: "You're next for water at {{tubewell}}. Please confirm READY or NOT READY within {{minutes}} minutes{{fieldPart}}",
    water_turn_alert_title: "Your Water Turn Is Starting",
    water_turn_alert_cancelled_title: "Water Turn Alert Cancelled",
    water_turn_alert_retry_again_title: "Water Turn — Please Confirm Again",
    water_turn_alert_retry_now_title: "Water Turn — Please Confirm Now",
    water_turn_alert_delayed_title: "Water Is Running Late",
    new_water_request_title: "New Water Request",
    water_request_rejected_title: "Water Request Rejected",
    water_request_accepted_title: "Water Request Accepted",
    you_are_next_title: "You Are Next!",
    removed_from_queue_title: "Removed from Queue",
    queue_position_updated_title: "Queue Position Updated",
    payment_request_received_title: "Payment request received",
    payment_approved_title: "Payment approved",
    payment_not_approved_title: "Payment not approved",
    water_started_title: "Water Started",
    water_session_ended_title: "Water Session Ended"
  },
  hi: {
    water_turn_alert_body: "आप अगले हैं पानी के लिए {{tubewell}}. कृपया {{minutes}} मिनटों के भीतर READY या NOT READY की पुष्टि करें{{fieldPart}}",
    water_turn_alert_title: "आपका पानी‑टर्न शुरू हो रहा है",
    water_turn_alert_cancelled_title: "पानी टर्न अलर्ट रद्द किया गया",
    water_turn_alert_retry_again_title: "पानी टर्न — कृपया फिर से पुष्टि करें",
    water_turn_alert_retry_now_title: "पानी टर्न — अभी पुष्टि करें",
    water_turn_alert_delayed_title: "पानी देर से चल रहा है",
    new_water_request_title: "नई पानी अनुरोध",
    water_request_rejected_title: "पानी अनुरोध अस्वीकृत",
    water_request_accepted_title: "पानी अनुरोध स्वीकृत",
    you_are_next_title: "आप अगले हैं!",
    removed_from_queue_title: "कतार से हटाए गए",
    queue_position_updated_title: "कतार स्थिति अपडेट हुई",
    payment_request_received_title: "भुगतान अनुरोध प्राप्त हुआ",
    payment_approved_title: "भुगतान स्वीकृत",
    payment_not_approved_title: "भुगतान अस्वीकृत",
    water_started_title: "पानी शुरू हुआ",
    water_session_ended_title: "पानी सत्र समाप्त"
  },
  pa: {
    water_turn_alert_body: "ਤੁਸੀਂ ਪਾਣੀ ਲਈ ਅਗਲੇ ਹੋ {{tubewell}}. ਕਿਰਪਾ ਕਰਕੇ {{minutes}} ਮਿੰਟਾਂ ਵਿੱਚ READY ਜਾਂ NOT READY ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ{{fieldPart}}",
    water_turn_alert_title: "ਤੁਹਾਡਾ ਪਾਣੀ ਟਰਨ ਸ਼ੁਰੂ ਹੋ ਰਿਹਾ ਹੈ",
    water_turn_alert_cancelled_title: "ਪਾਣੀ ਟਰਨ ਅਲਰਟ ਰੱਦ ਕੀਤਾ",
    water_turn_alert_retry_again_title: "ਪਾਣੀ ਟਰਨ — ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਪੁਸ਼ਟੀ ਕਰੋ",
    water_turn_alert_retry_now_title: "ਪਾਣੀ ਟਰਨ — ਹੁਣੇ ਪੁਸ਼ਟੀ ਕਰੋ",
    water_turn_alert_delayed_title: "ਪਾਣੀ ਦੇਰੀ ਨਾਲ ਚੱਲ ਰਿਹਾ ਹੈ",
    new_water_request_title: "ਨਵਾਂ ਪਾਣੀ ਬੇਨਤੀ",
    water_request_rejected_title: "ਪਾਣੀ ਬੇਨਤੀ ਰੱਦ ਕੀਤੀ ਗਈ",
    water_request_accepted_title: "ਪਾਣੀ ਬੇਨਤੀ ਮਨਜ਼ੂਰ ਹੋਈ",
    you_are_next_title: "ਤੁਸੀਂ ਅਗਲੇ ਹੋ!",
    removed_from_queue_title: "ਕਤਾਰ ਤੋਂ ਹਟਾਇਆ ਗਿਆ",
    queue_position_updated_title: "ਕਤਾਰ ਦੀ ਸਥਿਤੀ ਅਪਡੇਟ ਹੋਈ",
    payment_request_received_title: "ਭੁਗਤਾਨ ਬੇਨਤੀ ਪ੍ਰਾਪਤ ਹੋਈ",
    payment_approved_title: "ਭੁਗਤਾਨ ਮਨਜ਼ੂਰ ਕੀਤਾ",
    payment_not_approved_title: "ਭੁਗਤਾਨ ਮਨਜ਼ੂਰ ਨਹੀਂ ਹੋਇਆ",
    water_started_title: "ਪਾਣੀ ਸ਼ੁਰੂ ਹੋਇਆ",
    water_session_ended_title: "ਪਾਣੀ ਸੈਸ਼ਨ ਖਤਮ ਹੋਇਆ"
  },
};

export class TranslationService {
  translate(key: string, locale: Locale = 'en', params?: TranslationParams): string {
    const tmpl = messages[locale]?.[key] ?? messages['en'][key] ?? key;
    if (!params) return tmpl;
    return Object.entries(params).reduce((result, [k, v]) => {
      const placeholder = `{{${k}}}`;
      return result.replaceAll(placeholder, String(v));
    }, tmpl);
  }
}
