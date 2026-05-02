export const hi = {
  login: "अंदर जाएँ",
  logout: "बाहर जाएँ",
  pin: "पिन",
  name: "नाम",
  welcome: "आपका स्वागत है",
  businessName: "दुकान का नाम",
  phone: "फ़ोन",
  role: "काम",
  owner: "मालिक",
  employee: "कर्मचारी",

  dashboard: "घर",
  addDebt: "उधार जोड़ें",
  debtList: "उधार की लिस्ट",
  salesTracking: "बिक्री रिपोर्ट",
  inventoryTitle: "स्टॉक",
  inventorySubtitle: "दुकान का सारा सामान",
  addInventoryItem: "सामान जोड़ें",
  noInventory: "अभी कोई सामान नहीं है",
  totalUnpaid: "बाकी उधार",
  totalPaid: "मिला हुआ पैसा",
  totalProfit: "कुल फायदा",
  resetAll: "सब नया शुरू करें",
  resetSuccess: "सब 0 कर दिया गया!",

  customerName: "ग्राहक का नाम",
  phoneNumber: "फ़ोन नंबर",
  itemsTaken: "लिए गए सामान",
  amount: "पैसा",
  dueDate: "भुगतान की तारीख",
  dateTaken: "लेने की तारीख",
  paymentStatus: "भुगतान की हालत",
  willPayLater: "बाद में देगा",
  paid: "दे दिया",
  unpaid: "बाकी है",
  Inbox: "संदेश",
  addNew: "नया जोड़ें",
  search: "ढूँढें",
  noDebts: "कोई उधार नहीं है",
  totalDebt: "कुल उधार",
  customers: "ग्राहक",

  itemName: "सामान का नाम",
  costPrice: "खरीद का दाम",
  salePrice: "बेचने का दाम",
  quantity: "गिनती",
  dateSold: "बेचने की तारीख",
  dateBought: "खरीदने की तारीख",
  totalSales: "कुल बिक्री",
  noSales: "अभी कोई बिक्री नहीं",

  save: "सेव करें",
  cancel: "रद्द करें",
  delete: "हटाएँ",
  edit: "बदलें",
  call: "कॉल करें",
  sendMessage: "मैसेज भेजें",
  markAsPaid: "पैसा मिल गया",
  remind: "याद दिलाएँ",
  filter: "छाँटें",
  ok: "ठीक है",
  confirm: "पक्का करें",
  confirmDelete: "क्या आप सच में हटाना चाहते हैं?",
  back: "पीछे",
  next: "आगे",
  finish: "खत्म",

  customerNamePlaceholder: "ग्राहक का नाम लिखें...",
  phonePlaceholder: "07X XXX XXXX",
  itemNamePlaceholder: "सामान का नाम लिखें",
  quantityPlaceholder: "स्टॉक में कितने हैं",
  costPricePlaceholder: "खरीद का दाम",
  amountPlaceholder: "पैसा लिखें",
  messagePlaceholder: "मैसेज लिखें...",
  searchPlaceholder: "ढूँढें...",
  businessNamePlaceholder: "जैसे: Anil Shop",
  displayNamePlaceholder: "जैसे: Anil",

  debtSavedSuccess: "उधार सेव हो गया",
  saleSavedSuccess: "बिक्री सेव हो गई",
  markedAsPaid: "पैसा मिल गया",
  paymentRecorded: "भुगतान दर्ज हो गया",
  itemAdded: "सामान जुड़ गया",
  loading: "लोड हो रहा है...",
  error: "कुछ गड़बड़ हो गई",
  success: "हो गया",
  invalidPin: "पिन सही नहीं है",
  accountLocked: "खाता बंद है",
  tryAgain: "फिर कोशिश करें",

  settings: "सेटिंग्स",
  businessSettings: "दुकान की सेटिंग्स",
  initialCapital: "शुरू का पैसा",
  targetCapital: "लक्ष्य पैसा",
  saveSettings: "सेटिंग्स सेव करें",
  factoryReset: "सब नया शुरू करें",
  factoryResetConfirm: "इससे सारी जानकारी हट जाएगी",

  takePhoto: "फ़ोटो लें",
  selectFile: "फ़ोटो चुनें",
  imageUploaded: "फ़ोटो अपलोड हो गई",
  imageUploadError: "फ़ोटो अपलोड नहीं हुई",
  stock: "स्टॉक",
  lowStock: "स्टॉक कम है",
  outOfStock: "स्टॉक खत्म",

  appName: "Curuza +",
  jewelryBusiness: "दुकान",
  smartBusinessManager: "स्मार्ट दुकान मैनेजर",

  smsTemplates: {
    debtConfirmation:
      "नमस्ते {customerName}, आपने {enterpriseName} से {items} लिया है। कुल पैसा {amount} FRW है{dueDatePart}। धन्यवाद।",

    paymentThankYou:
      "नमस्ते {customerName}, {enterpriseName} को {amount} FRW देने के लिए धन्यवाद।",

    partialPaymentThankYou:
      "नमस्ते {customerName}, आपने {paidAmount} FRW दे दिया है। अब {remainingAmount} FRW बाकी है।",

    paymentReminder:
      "नमस्ते {customerName}, याद दिला रहे हैं कि {enterpriseName} में आपका {amount} FRW बाकी है{dueDatePart}।",

    overdueReminder:
      "नमस्ते {customerName}, आपका {amount} FRW अभी भी बाकी है। कृपया जल्दी भुगतान करें।",

    cashThankYou:
      "नमस्ते {customerName}, {enterpriseName} से {items} खरीदने के लिए धन्यवाद। आपने {amount} FRW दे दिया है।",

    generalThankYou:
      "नमस्ते {customerName}, {enterpriseName} के साथ काम करने के लिए धन्यवाद।",

    paymentRequest:
      "नमस्ते {customerName}, {enterpriseName} में आपका {amount} FRW बाकी है। कृपया जल्दी भुगतान करें।",

    dueDatePart: "। भुगतान की तारीख {dueDate} है",
    noDueDatePart: "",
  },
};

