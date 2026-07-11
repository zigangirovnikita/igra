/* eslint-disable */
const fs = require('fs');
const v1 = require('../config/game-config.v1.json');

const v2 = JSON.parse(JSON.stringify(v1));

v2.version = "2.0.0";
delete v2.superpowers;
delete v2.decay;

const eventRenames = {
  "manager_cold_leads": "manager_without_nurture",
  "manager_warm_leads": "manager_after_nurture",
  "hot_lead_lost": "inbound_lost",
  "client_thinking": "followup_available"
};

v2.events = v2.events.map(ev => {
  if (eventRenames[ev.id]) {
    ev.id = eventRenames[ev.id];
    ev.analyticsId = ev.id;
  }
  if (ev.id === 'manager_without_nurture') ev.messages = ["Менеджер получил лидов без прогрева."];
  if (ev.id === 'manager_after_nurture') ev.messages = ["Менеджер быстро разобрал подготовленных лидов."];
  if (ev.id === 'inbound_lost') ev.messages = ["Часть входящих осталась без ответа."];
  if (ev.id === 'followup_available') ev.messages = ["Часть клиентов ответила: «Я подумаю»."];
  if (ev.id === 'late_correct_decision') ev.messages = ["Позднее решение улучшило маршрут, но часть людей уже ушла."];
  return ev;
});

const actionsMetadata = {
  "friend_advice": { intent: "get_advice", group: "advice", configurationSteps: [], uiVisible: true },
  "smm_advice": { intent: "get_advice", group: "advice", configurationSteps: [], uiVisible: true },
  "consultation_basic": { intent: "get_advice", group: "advice", configurationSteps: [], uiVisible: true, upgradeGroup: "consultation", upgradeLevel: 1 },
  "consultation_detailed": { intent: "get_advice", group: "advice", configurationSteps: [], uiVisible: true, upgradeGroup: "consultation", upgradeLevel: 2, upgradeCost: 5000 },
  "demand_poll": { intent: "fix_system", group: "demand", configurationSteps: [], uiVisible: true, upgradeGroup: "demand", upgradeLevel: 1 },
  "demand_interviews": { intent: "fix_system", group: "demand", configurationSteps: [], uiVisible: true, upgradeGroup: "demand", upgradeLevel: 2 },
  "demand_pilot_offer": { intent: "fix_system", group: "demand", configurationSteps: [], uiVisible: true, upgradeGroup: "demand", upgradeLevel: 3 },
  "product_pilot": { intent: "fix_system", group: "product", configurationSteps: [], uiVisible: true, upgradeGroup: "product", upgradeLevel: 1 },
  "product_self": { intent: "fix_system", group: "product", configurationSteps: [], uiVisible: true, upgradeGroup: "product", upgradeLevel: 2 },
  "product_home": { intent: "fix_system", group: "product", configurationSteps: [], uiVisible: true, upgradeGroup: "product", upgradeLevel: 3 },
  "product_studio": { intent: "fix_system", group: "product", configurationSteps: [], uiVisible: true, upgradeGroup: "product", upgradeLevel: 4 },
  "stories_3d": { intent: "get_sales", group: "instagram", configurationSteps: ["content_type", "destination"], uiVisible: true },
  "reels_7d": { intent: "get_sales", group: "instagram", configurationSteps: ["content_type", "destination"], uiVisible: true },
  "reels_stories_7d": { intent: "get_sales", group: "instagram", configurationSteps: ["content_type", "destination"], uiVisible: true },
  "live_stream": { intent: "get_sales", group: "instagram", configurationSteps: ["content_type", "destination"], uiVisible: true },
  "telegram_warmup": { intent: "get_sales", group: "telegram", configurationSteps: ["content_type", "destination"], uiVisible: true },
  "webinar": { intent: "get_sales", group: "webinar", configurationSteps: ["content_type", "destination"], uiVisible: true },
  "guide_self": { intent: "fix_system", group: "nurture", configurationSteps: [], uiVisible: true, upgradeGroup: "guide", upgradeLevel: 1 },
  "guide_specialist": { intent: "fix_system", group: "nurture", configurationSteps: [], uiVisible: true, upgradeGroup: "guide", upgradeLevel: 2 },
  "video_self": { intent: "fix_system", group: "nurture", configurationSteps: [], uiVisible: true, upgradeGroup: "video", upgradeLevel: 1 },
  "video_specialist": { intent: "fix_system", group: "nurture", configurationSteps: [], uiVisible: true, upgradeGroup: "video", upgradeLevel: 2 },
  "simple_bot_self": { intent: "fix_system", group: "processing", configurationSteps: [], uiVisible: true, upgradeGroup: "simple_bot", upgradeLevel: 1 },
  "simple_bot_specialist": { intent: "fix_system", group: "processing", configurationSteps: [], uiVisible: true, upgradeGroup: "simple_bot", upgradeLevel: 2 },
  "ai_bot_self": { intent: "fix_system", group: "processing", configurationSteps: [], uiVisible: true, upgradeGroup: "ai_bot", upgradeLevel: 1 },
  "ai_bot_specialist": { intent: "fix_system", group: "processing", configurationSteps: [], uiVisible: true, upgradeGroup: "ai_bot", upgradeLevel: 2 },
  "hire_manager": { intent: "fix_system", group: "processing", configurationSteps: [], uiVisible: true },
  "website_basic": { intent: "fix_system", group: "website", configurationSteps: [], uiVisible: true, upgradeGroup: "website", upgradeLevel: 1 },
  "website_beautiful": { intent: "fix_system", group: "website", configurationSteps: [], uiVisible: true, upgradeGroup: "website", upgradeLevel: 2 },
  "website_auto_sale": { intent: "get_sales", group: "website", configurationSteps: [], uiVisible: false },
  "bot_auto_sale": { intent: "get_sales", group: "bot", configurationSteps: [], uiVisible: false },
  "webinar_sale": { intent: "get_sales", group: "webinar_sale", configurationSteps: [], uiVisible: false },
  "manual_chat": { intent: "get_sales", group: "sales", configurationSteps: [], uiVisible: false },
  "calls": { intent: "get_sales", group: "sales", configurationSteps: [], uiVisible: false },
  "manual_followup": { intent: "get_sales", group: "followup", configurationSteps: [], uiVisible: false },
  "bot_followup": { intent: "get_sales", group: "followup", configurationSteps: [], uiVisible: false },
  "rest_one_day": { intent: "restore_energy", group: "rest", configurationSteps: [], uiVisible: true },
  "rest_two_days": { intent: "restore_energy", group: "rest", configurationSteps: [], uiVisible: true }
};

v2.actions = v2.actions.map(act => {
  const meta = actionsMetadata[act.id] || { intent: "unknown", group: "unknown", configurationSteps: [], uiVisible: true };
  return { ...act, ...meta };
});

v2.actions.push({
  "id": "contacts_outreach",
  "enabled": true,
  "category": "content",
  "intent": "get_sales",
  "group": "contacts",
  "title": "Написать по базе контактов",
  "cost": 0,
  "days": 1,
  "energyCost": 5,
  "requirements": [
    {
      "operator": "in",
      "path": "audience.channels",
      "value": ["contacts"]
    }
  ],
  "effects": [],
  "repeatPolicy": "unlimited",
  "configurationSteps": ["content_type", "destination"],
  "uiVisible": true,
  "analyticsId": "contacts_outreach"
});

v2.content.contactsResponseRate = 0.05;

fs.writeFileSync('./config/game-config.v2.json', JSON.stringify(v2, null, 2));
console.log('Created v2 config');
