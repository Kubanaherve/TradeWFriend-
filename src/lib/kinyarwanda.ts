export const labels = {
  // Auth & Navigation
  login: "Injira",
  logout: "Sohoka",
  pin: "PIN",
  name: "Izina",
  welcome: "Murakaza neza",
  businessName: "Izina ry'ubucuruzi",
  phone: "Telefone",
  role: "Inshingano",
  owner: "Nyir'ubucuruzi",
  employee: "Umukozi",

  // Dashboard
  dashboard: "Ibikubiye",
  addDebt: "Ongeraho Ideni",
  debtList: "Urutonde rw'Abafite Ideni",
  salesTracking: "Raporo Irambuye",
  inventoryTitle: "Ibyo naranguye",
  inventorySubtitle: "Ibintu byose yaguze",
  addInventoryItem: "Ongeraho Ikintu",
  noInventory: "Nta kintu kihari",
  totalUnpaid: "Amafaranga yose atarishyurwa",
  totalPaid: "Amafaranga yishyuwe",
  totalProfit: "Inyungu yose",
  resetAll: "Tangira Bushya",
  resetSuccess: "Amafaranga yasubijwe kuri 0!",

  // Customer & Debt Fields
  customerName: "Izina ry'umukiriya",
  phoneNumber: "Numero ya Telefone",
  itemsTaken: "Ibintu Byatwawe",
  amount: "Amafaranga",
  dueDate: "Itariki yo kwishyura",
  dateTaken: "Itariki yo gufata",
  paymentStatus: "Imiterere y'ubwishyu",
  willPayLater: "Azishyura nyuma",
  paid: "Yishyuye",
  unpaid: "Ntarishyura",
  Inbox: "Ubutumwa",
  addNew: "Ongeraho Ikindi",
  search: "Shakisha",
  noDebts: "Nta deni rihari",
  totalDebt: "Ideni ryose",
  customers: "Abakiriya",

  // Sales Fields
  itemName: "Izina ry'ikintu",
  costPrice: "Igiciro cyo kugura",
  salePrice: "Igiciro cyo kugurisha",
  quantity: "Umubare",
  dateSold: "Itariki byagurishijweho",
  dateBought: "Itariki byaguzweho",
  totalSales: "Amafaranga yose yinjijwe",
  noSales: "Nta kintu cyagurishijwe",

  // Actions
  save: "Emeza",
  cancel: "Bireke",
  delete: "Siba",
  edit: "Hindura",
  call: "Muhamagare",
  sendMessage: "Mwohereze ubutumwa",
  markAsPaid: "Amaze kunyishyura",
  remind: "Mwibutse",
  filter: "Tondeka",
  ok: "Ok",
  confirm: "Emeza",
  confirmDelete: "Urashaka gusiba?",
  back: "Subira inyuma",
  next: "Komeza",
  finish: "Soza",

  // Placeholders
  customerNamePlaceholder: "Izina ry'umukiriya...",
  phonePlaceholder: "07X XXX XXXX",
  itemNamePlaceholder: "Izina ry'ikintu",
  quantityPlaceholder: "Umubare uri muri stock",
  costPricePlaceholder: "Igiciro cyo kugura",
  amountPlaceholder: "Andika amafaranga",
  messagePlaceholder: "Andika ubutumwa...",
  searchPlaceholder: "Shakisha...",
  businessNamePlaceholder: "Urugero: Chez Marie Shop",
  displayNamePlaceholder: "Urugero: Jeanne",

  // Messages
  debtSavedSuccess: "Ideni ryashyizweho neza",
  saleSavedSuccess: "Icyagurishijwe cyashyizweho neza",
  markedAsPaid: "Byamaze kwishyurwa",
  paymentRecorded: "Ubwishyu bwashyizweho",
  itemAdded: "Ikintu cyongeyeho",
  loading: "Birimo...",
  error: "Habaye ikosa",
  success: "Byagenze neza",
  invalidPin: "PIN ntiyemera",
  accountLocked: "Konti irafunze",
  tryAgain: "Ongera ugerageze",

  // Settings
  settings: "Igenamiterere",
  businessSettings: "Igenamiterere ry'ubucuruzi",
  initialCapital: "Amafaranga y'ibanze",
  targetCapital: "Amafaranga y'intego",
  saveSettings: "Emeza igenamiterere",
  factoryReset: "Tangira bushya",
  factoryResetConfirm: "Ibi bizasiba amakuru yose",

  // Inventory
  takePhoto: "Fata ifoto",
  selectFile: "Hitamo ifoto",
  imageUploaded: "Ifoto yashyizweho",
  imageUploadError: "Ifoto ntiyashyizweho",
  stock: "Stock",
  lowStock: "Stock nkeya",
  outOfStock: "Nta stock ihari",

  // App Info
  appName: "Curuza +",
  jewelryBusiness: "Ubucuruzi",
  smartBusinessManager: "Umuyobozi w'ubucuruzi w'intelligensiya",

  // SMS Templates
  smsTemplates: {
    debtConfirmation:
      "Muraho {customerName}. Murakoze kugura kuri {enterpriseName}. Mwafashe {items}. Amafaranga yose ni {amount} FRW{dueDatePart}. Murakoze.",

    paymentThankYou:
      "Muraho {customerName}. {enterpriseName} ibashimiye ko mwishyuye {amount} FRW. Murakoze ku bwizerane bwanyu.",

    partialPaymentThankYou:
      "Muraho {customerName}. Murakoze kwishyura {paidAmount} FRW kuri {enterpriseName}. Hasigaye {remainingAmount} FRW.",

    paymentReminder:
      "Muraho {customerName}. Turabibutsa ko musigayemo kwishyura {amount} FRW kuri {enterpriseName}{dueDatePart}. Murakoze.",

    overdueReminder:
      "Muraho {customerName}. Ubwishyu bwa {amount} FRW kuri {enterpriseName} buracyategerejwe. Turabasaba kubukora vuba. Murakoze.",

    cashThankYou:
      "Muraho {customerName}. Murakoze kugura {items} kuri {enterpriseName}. Mwishyuye {amount} FRW. Murakoze.",

    generalThankYou:
      "Muraho {customerName}. Murakoze gukorana na {enterpriseName}. Twishimiye kubakorera.",

    paymentRequest:
      "Muraho {customerName}. Murabwirwa ko hari ubwishyu bwa {amount} FRW bugitegerejwe kuri {enterpriseName}. Turabasaba kubwishyura vuba. Murakoze.",

    dueDatePart: ". Itariki yo kwishyura ni {dueDate}",
    noDueDatePart: "",
  },
} as const;

export const formatCurrency = (amount: number): string => {
  return (
    new Intl.NumberFormat("rw-RW", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " FRW"
  );
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-RW", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};