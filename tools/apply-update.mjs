// Minimal update: preserve CalculatorView.vue template, CSS, and existing keypad.
// Run: node tools/apply-update.mjs /path/to/project
import fs from "node:fs";
import path from "node:path";

const base = path.resolve(process.argv[2] || ".");
const locate = (filename) => {
  const candidates = [
    path.join(base, "frontend/src/views", filename),
    path.join(base, "src/views", filename),
  ];
  return candidates.find(fs.existsSync);
};
const calculatorFile = locate("CalculatorView.vue");
const invoiceFile = locate("InvoiceListView.vue");
if (!calculatorFile || !invoiceFile)
  throw new Error(
    "Expected CalculatorView.vue and InvoiceListView.vue under frontend/src/views or src/views.",
  );
const MARK = "SODA_CATEGORY_DRAFT_2026";

function renameDeclaration(src, oldName, newName) {
  const re = new RegExp(`\\bconst\\s+${oldName}\\s*=`, "g");
  const count = [...src.matchAll(re)].length;
  if (count !== 1)
    throw new Error(
      `Expected 1 declaration const ${oldName} =, found ${count}`,
    );
  return src.replace(re, `const ${newName} =`);
}
function addScript(src, code) {
  if (!src.includes("</script>"))
    throw new Error("Vue file missing </script>.");
  return src.replace("</script>", `\n${code}\n</script>`);
}

const calculatorCode = String.raw`
/* SODA_CATEGORY_DRAFT_2026
   The existing selectCategory UI and keypad are unchanged.
   Switching categories stages current rows in memory (not database).
   The existing Save button saves all staged groups in ONE request.
*/
const { locale: invoiceLocale } = useI18n();
const invoiceDraftGroups = ref([]);
const invoiceCategoryId = value => String(value?._id ?? value?.id ?? value ?? '');
const snapshotRows = rows => (rows || []).map(item => ({ ...item }));

const preSaveCurrentCategory = () => {
  const category = invoiceCategoryId(selectedCategoryId.value);
  if (!category) return;
  const existing = invoiceDraftGroups.value.findIndex(group => group.category === category);
  const calculatorRows = snapshotRows(calculatorData.value);
  if (!calculatorRows.length) {
    if (existing >= 0) invoiceDraftGroups.value.splice(existing, 1);
    return;
  }
  const selected = (categories.value || []).find(item => invoiceCategoryId(item) === category);
  const names = typeof selectedSubCategories !== 'undefined'
    ? (selectedSubCategories.value || []).map(item => item.name || item.subCategoryName).filter(Boolean)
    : [];
  const group = {
    category,
    categoryName: String(selected?.name || category),
    subCategories: (selectedSubCategoryIds.value || []).map(invoiceCategoryId),
    subCategoryNames: names,
    calculatorData: calculatorRows,
  };
  if (existing >= 0) invoiceDraftGroups.value.splice(existing, 1, group);
  else invoiceDraftGroups.value.push(group);
};

// Reuses the existing implementation for selection/reset/loading behavior.
const selectCategory = async (...args) => {
  preSaveCurrentCategory();
  await selectCategoryBeforeDraft(...args);
  const previous = invoiceDraftGroups.value.find(
    group => group.category === invoiceCategoryId(selectedCategoryId.value)
  );
  if (previous) {
    selectedSubCategoryIds.value = [...previous.subCategories];
    calculatorData.value = snapshotRows(previous.calculatorData);
  }
};

// Replaces the former single-category POST with a single grouped-invoice POST.
const saveCalculation = async () => {
  if (saving.value) return;
  preSaveCurrentCategory();
  if (!invoiceDraftGroups.value.length) {
    toast.add({ severity: 'warn', summary: invoiceLocale.value === 'km'
      ? 'សូមបញ្ចូលទិន្នន័យជាមុន' : 'Add at least one entry', life: 2400 });
    return;
  }
  const payload = {
    groups: invoiceDraftGroups.value.map(group => ({
      category: group.category,
      categoryName: group.categoryName,
      subCategories: [...group.subCategories],
      subCategoryNames: [...group.subCategoryNames],
      calculatorData: group.calculatorData.map(item => ({
        raw: String(item.raw || '').trim(),
        baseValue: Number(item.baseValue),
      })),
    })),
  };
  try {
    saving.value = true;
    await api.post('/batch-invoices', payload);
    invoiceDraftGroups.value = [];
    resetCalculator();
    selectedCategoryId.value = null;
    selectedSubCategoryIds.value = [];
    calculatorData.value = [];
    toast.add({ severity: 'success', summary: invoiceLocale.value === 'km'
      ? 'បានរក្សាទុកវិក្កយបត្រ' : 'Invoice saved', life: 1800 });
    await router.push('/invoices');
  } catch (error) {
    console.error('SAVE MULTI CATEGORY INVOICE:', error);
    toast.add({ severity: 'error', summary: invoiceLocale.value === 'km'
      ? 'រក្សាទុកមិនបាន' : 'Save failed',
      detail: error.response?.data?.message || error.message, life: 3000 });
  } finally {
    saving.value = false;
  }
};
`;

function patchCalculator(src) {
  if (src.includes(MARK))
    throw new Error(
      "CalculatorView.vue was already updated; do not run twice.",
    );
  for (const id of [
    "selectedCategoryId",
    "selectedSubCategoryIds",
    "calculatorData",
    "categories",
    "saving",
  ]) {
    if (!new RegExp(`\\b${id}\\b`).test(src))
      throw new Error(
        `CalculatorView.vue missing ${id}; latest file is different.`,
      );
  }
  if (!/@(?:click|change)\s*=\s*["'][^"']*selectCategory/.test(src)) {
    throw new Error(
      "Calculator category selection is not bound to selectCategory; cannot safely preserve its behavior.",
    );
  }
  src = renameDeclaration(src, "selectCategory", "selectCategoryBeforeDraft");
  src = renameDeclaration(src, "saveCalculation", "saveCalculationBeforeDraft");
  src = addScript(src, calculatorCode);
  // Adds one unobtrusive indicator; does not alter existing buttons/keypad/classes.
  const indicator = `
    <div v-if="invoiceDraftGroups.length" class="mx-auto mt-2 flex max-w-6xl flex-wrap items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
      <span class="font-semibold">{{ invoiceLocale === 'km' ? 'ព្រាងវិក្កយបត្រ' : 'Invoice draft' }}:</span>
      <span v-for="group in invoiceDraftGroups" :key="group.category" class="rounded-md bg-white px-2 py-1">{{ group.categoryName }} ({{ group.calculatorData.length }})</span>
    </div>
  `;
  if (!/<main\b[^>]*>/i.test(src))
    throw new Error("CalculatorView.vue has no <main>.");
  return src.replace(/(<main\b[^>]*>)/i, `${indicator}$1`);
}

const invoiceCode = String.raw`
/* SODA_CATEGORY_DRAFT_2026: grouped invoices in existing list UI */
const getLines = record => Array.isArray(record?.groups)
  ? record.groups.flatMap(group => (group.calculatorData || []).map(item => ({
      ...item, invoiceGroupName: group.categoryName,
    })))
  : getLinesBeforeDraft(record);
const categoryName = record => Array.isArray(record?.groups)
  ? (record.groups.map(group => group.categoryName).filter(Boolean).join(', ') || '—')
  : categoryNameBeforeDraft(record);
const getSubCategoryNames = record => Array.isArray(record?.groups)
  ? [...new Set(record.groups.flatMap(group => group.subCategoryNames || []))]
  : getSubCategoryNamesBeforeDraft(record);
const expressionText = item => item?.invoiceGroupName
  ? '[' + item.invoiceGroupName + '] ' + expressionTextBeforeDraft(item)
  : expressionTextBeforeDraft(item);
const loadRecords = async () => {
  loading.value = true;
  try {
    const responses = await Promise.allSettled([
      api.get('/number-cal'), api.get('/batch-invoices')
    ]);
    const unpack = r => {
      const data = r?.data;
      return Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.records) ? data.records : [];
    };
    if (responses.every(r => r.status === 'rejected')) throw responses[0].reason;
    records.value = responses.flatMap(r => r.status === 'fulfilled' ? unpack(r.value) : [])
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    for (const r of responses) if (r.status === 'rejected') console.error('INVOICE SOURCE FAILED:', r.reason);
  } catch (error) {
    console.error('LOAD INVOICES:', error);
    toast.add({ severity: 'error', summary: t('invoice.loadFailed'),
      detail: error.response?.data?.message || t('invoice.loadFailedDetail'), life: 2500 });
  } finally {
    loading.value = false;
  }
};
const deleteRecord = async record => {
  if (!Array.isArray(record?.groups)) return deleteRecordBeforeDraft(record);
  if (!record?._id) return;
  try {
    deletingId.value = record._id;
    await api.delete('/batch-invoices/' + record._id);
    records.value = records.value.filter(item => item._id !== record._id);
    if (selectedRecord.value?._id === record._id) closeDetail();
    toast.add({ severity: 'success', summary: t('invoice.deleted'),
      detail: t('invoice.deleteSuccess'), life: 1500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: t('invoice.deleteFailed'),
      detail: error.response?.data?.message || t('invoice.deleteFailedDetail'), life: 2500 });
  } finally {
    deletingId.value = null;
  }
};
`;

function patchInvoice(src) {
  if (src.includes(MARK))
    throw new Error(
      "InvoiceListView.vue was already updated; do not run twice.",
    );
  for (const name of [
    "getLines",
    "categoryName",
    "getSubCategoryNames",
    "expressionText",
    "loadRecords",
    "deleteRecord",
  ]) {
    src = renameDeclaration(src, name, name + "BeforeDraft");
  }
  return addScript(src, invoiceCode);
}

// Both files must match before changing ANY source.
const originalCalculator = fs.readFileSync(calculatorFile, "utf8");
const originalInvoice = fs.readFileSync(invoiceFile, "utf8");
const updatedCalculator = patchCalculator(originalCalculator);
const updatedInvoice = patchInvoice(originalInvoice);
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
for (const [file, before, after] of [
  [calculatorFile, originalCalculator, updatedCalculator],
  [invoiceFile, originalInvoice, updatedInvoice],
]) {
  fs.writeFileSync(file + ".backup-" + stamp, before, "utf8");
  fs.writeFileSync(file, after, "utf8");
  console.log("Updated:", file);
}
console.log("Done. Your original UI and CSS are preserved.");
