// Kinyarwanda labels dictionary
export const labels = {
  // Auth & Navigation
  login: "Injira",
  logout: "Sohoka",
  pin: "PIN",
  name: "Izina",
  welcome: "Murakaza neza",
  
  // Dashboard
  dashboard: "Ibikubiye",
  addDebt: "Ongeraho Ideni",
  debtList: "Urutonde rw'Abafite Ideni",
  salesTracking: "Gukurikirana Ibyagurishijwe",
  profitRevenue: "Umusaruro n'Amafaranga Yinjijwe",
  totalUnpaid: "Amafaranga yose atarishyurwa",
  
  // Customer & Debt Fields
  customerName: "Izina ry'umukiriya",
  phoneNumber: "Numero ya Telefone",
  itemsTaken: "Bijoux Zatwawe",
  amount: "Amafaranga",
  dueDate: "Itariki yo Kwishyura",
  dateTaken: "Itariki yo gufata",
  paymentStatus: "Imiterere y'Ubwishyu",
  willPayLater: "Azishyura nyuma",
  paid: "Yishyuye",
  unpaid: "Ntarishyura",
  
  // Sales Fields
  itemName: "Izina rya Bijoux",
  costPrice: "Igiciro cyo Kugura",
  salePrice: "Igiciro cyo Kugurisha",
  quantity: "Umubare",
  dateSold: "Itariki byagurishijweho",
  dateBought: "Itariki byaguzweho",
  
  // Actions
  save: "Emeza",
  cancel: "Bireke",
  addNew: "Ongeraho Ikindi",
  delete: "Siba",
  edit: "Hindura",
  call: "Muhamagare",
  sendMessage: "Mwohereze Ubutumwa",
  markAsPaid: "Amaze kunyishyura",
  remind: "Musobanurire",
  filter: "Tondeka",
  search: "Shakisha",
  ok: "Ok",
  confirm: "Emeza",
  
  // Summary
  totalSales: "Amafaranga yose yinjijwe",
  totalProfit: "Totali y'Inyungu",
  totalDebt: "Ideni ryose",
  customers: "Abakiriya",
  
  // Messages
  debtSavedSuccess: "Ideni ryashyizweho neza",
  saleSavedSuccess: "Icyagurishijwe cyashyizweho neza",
  markedAsPaid: "Byamaze kwishyurwa",
  confirmDelete: "Urashaka gusiba?",
  confirmResetAll: "Urashaka gusiba byose no gutangira bushya?",
  resetAll: "Siba Byose",
  resetSuccess: "Byose byasubijwe aho byari!",
  noDebts: "Nta deni rihari",
  noSales: "Nta kintu cyagurishijwe",
  invalidPin: "PIN ntiyemera",
  
  // App Info
  appName: "Jeanne Friend Jewelry",
  jewelryBusiness: "Ubucuruzi bwa Bijoux",
} as const;

// SMS message templates
export const smsTemplates = {
  // Immediate SMS after saving debt
  debtConfirmation: (items: string, amount: string) => 
    `Muraho mufashe ${items} amafaranga muzishyura ni ${amount} FRW. MERCI BEAUCOUP CHER CLIENT`,
  
  // Optional reminder SMS
  debtReminder: (items: string, amount: string) => 
    `Muraho, mwampaye kuri ${items} amafaranga muzishyura ni ${amount} FRW`,
  
  // Cash acknowledgment
  cashAcknowledgment: () => 
    `Muraho neza! Wampaye kuri cash nshuti. Merci!!`,
};

// Format currency in RWF
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('rw-RW', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FRW';
};

// Format date in local format
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-RW', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
