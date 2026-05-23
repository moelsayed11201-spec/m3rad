// Firebase direct integration replaced all the API fetch calls
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addMonths, format, parseISO } from "date-fns";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
  serverTimestamp,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj !== "object") {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  const constructorName = obj.constructor?.name;
  if (constructorName && constructorName !== 'Object' && constructorName !== 'Array') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      cleaned[key] = cleanUndefined(value);
    }
  }
  return cleaned;
}

function attachUserMetadata(
  obj: any,
  user: User | null | undefined,
  isUpdate = false,
) {
  if (!user) return cleanUndefined(obj);
  const now = new Date().toISOString();
  let result;
  if (isUpdate) {
    result = {
      ...obj,
      updatedBy: user.id,
      updatedAt: now,
    };
  } else {
    let finalBranchId = obj.branchId;
    if (!finalBranchId) {
      if (user.branchIds && user.branchIds.length > 0) {
        finalBranchId = user.branchIds[0];
      } else {
        try {
          const branches = useStore.getState().branches;
          if (branches && branches.length > 0) {
            finalBranchId = branches[0].id;
          } else {
            finalBranchId = "default-branch";
          }
        } catch (e) {
          finalBranchId = "default-branch";
        }
      }
    }

    result = {
      ...obj,
      createdBy: user.id,
      createdAt: now,
      branchId: finalBranchId,
    };
  }
  return cleanUndefined(result);
}

function calculateCustomerLoyalty(
  customer: any,
  contracts: any[],
): {
  lastPurchaseDate: string | null;
  contractsCountLast6Months: number;
  isPreferredCustomer: boolean;
} {
  const customerContracts = contracts.filter(
    (c) => c.customerId === customer.id && c.status !== "ملغى" && !c.isDeleted,
  );
  if (customerContracts.length === 0) {
    return {
      lastPurchaseDate: null,
      contractsCountLast6Months: 0,
      isPreferredCustomer: false,
    };
  }

  // Sort contracts by startDate descending
  const sortedContracts = [...customerContracts].sort((a, b) => {
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const lastPurchaseDate = sortedContracts[0]?.startDate || null;

  // Count contracts in the last 6 months (180 days)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoTime = sixMonthsAgo.getTime();

  const contractsCountLast6Months = customerContracts.filter((c) => {
    if (!c.startDate) return false;
    const contractDate = new Date(c.startDate).getTime();
    return contractDate >= sixMonthsAgoTime;
  }).length;

  const isPreferredCustomer = contractsCountLast6Months > 0;

  return {
    lastPurchaseDate,
    contractsCountLast6Months,
    isPreferredCustomer,
  };
}

export type ContractStatus = "مسودة" | "نشط" | "متأخر" | "مكتمل" | "ملغى";
export type InstallmentStatus = "معلق" | "مدفوع" | "مدفوع جزئياً" | "متأخر";
export type UserRole = "ceo" | "manager" | "employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  branchIds: string[];
  createdAt?: string;
  createdBy?: string;
}
export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  date: string;
  type: "alert" | "success" | "info";
}

export interface SoftDelete {
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CorrectionRequest {
  id: string;
  branchId: string;
  collectionName: string;
  documentId: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  proposedChanges: any;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface AuditLog {
  id: string;
  branchId?: string;
  actorId: string;
  actorRole: string;
  action: string;
  collectionName: string;
  documentId: string;
  beforeData?: any;
  afterData?: any;
  createdAt: string;
  source: "app" | "system";
}

export interface Revenue {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  referenceId?: string;
  isDeleted?: boolean;
}

export interface InventoryMovement extends SoftDelete {
  id: string;
  productId: string;
  quantity: number;
  type: "in" | "out";
  date: string;
  referenceId?: string;
  notes: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface Customer extends SoftDelete {
  id: string;
  customerCode?: string;
  name: string;
  phone: string;
  email?: string;
  nationalId: string;
  address: string;
  city: string;
  employer: string;
  salary: number;
  status: "نشط" | "موقوف";
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  lastPurchaseDate?: string;
  contractsCountLast6Months?: number;
  isPreferredCustomer?: boolean;
}
export interface Sponsor extends SoftDelete {
  id: string;
  name: string;
  phone: string;
  nationalId: string;
  address: string;
  employer: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface Product extends SoftDelete {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  price: number;
  costPrice: number;
  cashPrice: number;
  lowStockThreshold: number;
  supplier: string;
  supplierId?: string;
  notes: string;
  stock: number;
  barcode: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface Supplier extends SoftDelete {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
  categories?: string[];
  notes?: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  productsSupplied?: string[];
}
export interface Expense extends SoftDelete {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes: string;
  type: "in" | "out";
  referenceId?: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface Installment extends SoftDelete {
  id: string;
  contractId: string;
  number: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentDate?: string;
  status: InstallmentStatus;
  lateDays: number;
  lateFees: number;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface ContractItem {
  productId: string;
  quantity: number;
  productPrice: number;
}
export interface Contract extends SoftDelete {
  id: string;
  contractNumber: string;
  customerId: string;
  sponsorId?: string;
  productId?: string;
  quantity?: number;
  productPrice?: number;
  items?: ContractItem[];
  totalContractAmount: number;
  downPayment: number;
  financedAmount: number;
  interestRate: number;
  totalInterest: number;
  adminFees: number;
  startDate: string;
  frequency: "شهري" | "ربع سنوي" | "سنوي";
  numberOfInstallments: number;
  installmentAmount: number;
  status: ContractStatus;
  contractType?: "تقسيط" | "نقدي";
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface PaymentReceipt extends SoftDelete {
  id: string;
  installmentId: string;
  contractId: string;
  customerId: string;
  amount: number;
  date: string;
  method: "نقدي" | "تحويل بنكي" | "بطاقة ائتمان" | "شيك";
  collector: string;
  notes: string;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface ProductCategory extends SoftDelete {
  id: string;
  name: string;
  isActive: number;
  branchId: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface StoreState {
  currentUser: User | null;
  users: User[];
  branches: Branch[];
  notifications: Notification[];
  inventoryMovements: InventoryMovement[];
  customers: Customer[];
  products: Product[];
  productCategories: ProductCategory[];
  suppliers: Supplier[];
  sponsors: Sponsor[];
  contracts: Contract[];
  installments: Installment[];
  receipts: PaymentReceipt[];
  expenses: Expense[];
  revenues: Revenue[];
  auditLogs: AuditLog[];
  correctionRequests: CorrectionRequest[];
  settings: Record<string, string>;
  theme: "dark" | "light";
  fetchInitialData: () => Promise<void>;
  updateSettings: (newSettings: Record<string, string>) => Promise<void>;
  login: (user: User) => void;
  logout: () => void;
  markNotificationAsRead: (id: string) => void;

  // New Management Methods
  addAuditLog: (
    log: Omit<
      AuditLog,
      "id" | "createdAt" | "actorId" | "actorRole" | "source"
    >,
  ) => Promise<void>;
  createCorrectionRequest: (
    request: Omit<
      CorrectionRequest,
      "id" | "requestedBy" | "requestedAt" | "status"
    >,
  ) => Promise<void>;
  reviewCorrectionRequest: (
    id: string,
    status: "approved" | "rejected",
    note: string,
  ) => Promise<void>;

  // User & Branch Management
  addUser: (user: User) => Promise<void>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  addBranch: (branch: any) => Promise<void>;
  updateBranch: (id: string, branch: Partial<Branch>) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;

  addCustomer: (customer: any) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string, reason?: string) => Promise<void>;
  addProduct: (product: any) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string, reason?: string) => Promise<void>;
  addProductCategory: (category: any) => Promise<void>;
  updateProductCategory: (category: ProductCategory) => Promise<void>;
  deleteProductCategory: (id: string, reason?: string) => Promise<void>;
  addSupplier: (supplier: any) => Promise<void>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string, reason?: string) => Promise<void>;
  addExpense: (expense: any) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string, reason?: string) => Promise<void>;
  addRevenue: (revenue: any) => Promise<void>;
  deleteRevenue: (id: string, reason?: string) => Promise<void>;
  addContract: (contract: any) => Promise<void>;
  cancelContract: (id: string, reason: string) => Promise<void>;
  deleteContract: (id: string) => Promise<void>; // Soft delete
  recordPayment: (receipt: any) => Promise<void>;
  setTheme: (theme: "dark" | "light") => void;
}

const generateInstallments = (
  contract: Contract,
  user: User | null,
): Installment[] => {
  const installments: Installment[] = [];
  const start = parseISO(contract.startDate);
  for (let i = 1; i <= contract.numberOfInstallments; i++) {
    const dueDate = format(addMonths(start, i), "yyyy-MM-dd");
    const rawInst = {
      id: `inst-${contract.id}-${i}`,
      contractId: contract.id,
      number: i,
      dueDate,
      amount: contract.installmentAmount,
      paidAmount: 0,
      remainingAmount: contract.installmentAmount,
      status: "معلق" as InstallmentStatus,
      lateDays: 0,
      lateFees: 0,
    };
    installments.push(attachUserMetadata(rawInst, user) as Installment);
  }
  return installments;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],
      branches: [],
      notifications: [],
      inventoryMovements: [],
      customers: [],
      products: [],
      productCategories: [],
      suppliers: [],
      sponsors: [],
      contracts: [],
      installments: [],
      receipts: [],
      expenses: [],
      revenues: [],
      auditLogs: [],
      correctionRequests: [],
      settings: {},
      theme: "dark",

      login: (user) => {
        set({ currentUser: user });
        if (user.isActive) {
          useStore.getState().fetchInitialData();
        }
      },

      logout: () => {
        set({
          currentUser: null,
          users: [],
          branches: [],
          notifications: [],
          inventoryMovements: [],
          customers: [],
          products: [],
          productCategories: [],
          suppliers: [],
          sponsors: [],
          contracts: [],
          installments: [],
          receipts: [],
          expenses: [],
          revenues: [],
          auditLogs: [],
          correctionRequests: [],
        });
      },

      fetchInitialData: async () => {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return;

          const currentUser = get().currentUser;
          if (!currentUser) return;

          const isCEO = currentUser.role === "ceo";
          const userBranchIds = currentUser.branchIds || [];

          const fetchQuery = async (collName: string) => {
            try {
              if (!isCEO && collName === "auditLogs") return [];

              let q = query(collection(db, collName));
              const collectionsWithBranch = [
                "customers",
                "products",
                "contracts",
                "installments",
                "receipts",
                "inventoryMovements",
                "expenses",
                "product_categories",
                "suppliers",
                "revenues",
                "correctionRequests",
              ];

              if (
                !isCEO &&
                collectionsWithBranch.includes(collName) &&
                userBranchIds.length > 0
              ) {
                q = query(
                  collection(db, collName),
                  where("branchId", "in", userBranchIds.slice(0, 10)),
                );
              } else if (!isCEO && collName === "branches" && userBranchIds.length > 0) {
                q = query(
                  collection(db, "branches"),
                  where("id", "in", userBranchIds.slice(0, 10)),
                );
              } else if (!isCEO && collName === "users" && userBranchIds.length > 0) {
                q = query(
                  collection(db, "users"),
                  where("branchIds", "array-contains-any", userBranchIds.slice(0, 10)),
                );
              }

              // Apply smart limits on startup to keep database loads fast
              const listLimits: Record<string, number> = {
                auditLogs: 100,
                inventoryMovements: 400,
                expenses: 800,
                revenues: 500,
                receipts: 1500,
                installments: 3000,
                contracts: 1500,
                customers: 1500,
              };

              if (listLimits[collName]) {
                q = query(q, limit(listLimits[collName]));
              }

              const snap = await getDocs(q);
              let data = snap.docs.map(
                (d) => ({ ...d.data(), id: d.id }) as any,
              );

              if (
                collName !== "auditLogs" &&
                collName !== "correctionRequests"
              ) {
                data = data.filter((d) => !d.isDeleted);
              }

              return data;
            } catch (error) {
              try {
                handleFirestoreError(error, OperationType.LIST, collName);
              } catch (_) {}
              return null;
            }
          };

          let settingsDocs = null;
          try {
            settingsDocs = await getDocs(collection(db, "settings"));
          } catch (error) {
            try {
              handleFirestoreError(error, OperationType.LIST, "settings");
            } catch (_) {}
          }

          const [
            rawCustomers,
            rawProducts,
            rawContracts,
            rawInstallments,
            rawReceipts,
            rawInvs,
            rawExpenses,
            rawCategories,
            rawSuppliers,
            rawUsers,
            rawBranches,
            rawRevenues,
            rawAuditLogs,
            rawCorrectionRequests,
          ] = await Promise.all([
            fetchQuery("customers"),
            fetchQuery("products"),
            fetchQuery("contracts"),
            fetchQuery("installments"),
            fetchQuery("receipts"),
            fetchQuery("inventoryMovements"),
            fetchQuery("expenses"),
            fetchQuery("product_categories"),
            fetchQuery("suppliers"),
            fetchQuery("users"),
            fetchQuery("branches"),
            fetchQuery("revenues"),
            fetchQuery("auditLogs"),
            fetchQuery("correctionRequests"),
          ]);

          const state = get();

          const customers = rawCustomers !== null ? rawCustomers : state.customers;
          const products = rawProducts !== null ? rawProducts : state.products;
          const contracts = rawContracts !== null ? rawContracts : state.contracts;
          const installments = rawInstallments !== null ? rawInstallments : state.installments;
          const receipts = rawReceipts !== null ? rawReceipts : state.receipts;
          const invs = rawInvs !== null ? rawInvs : state.inventoryMovements;
          const expenses = rawExpenses !== null ? rawExpenses : state.expenses;
          const categories = rawCategories !== null ? rawCategories : state.productCategories;
          const suppliers = rawSuppliers !== null ? rawSuppliers : state.suppliers;
          const usersData = rawUsers !== null ? rawUsers : state.users;
          const branchesData = rawBranches !== null ? rawBranches : state.branches;
          const revenues = rawRevenues !== null ? rawRevenues : state.revenues;
          const auditLogs = rawAuditLogs !== null ? rawAuditLogs : state.auditLogs;
          const correctionRequests = rawCorrectionRequests !== null ? rawCorrectionRequests : state.correctionRequests;

          const settingsObj: Record<string, string> = { ...state.settings };
          if (settingsDocs && typeof settingsDocs.forEach === "function") {
            settingsDocs.forEach((d: any) => {
              settingsObj[d.id] = d.data().value;
            });
          }

          // Pre-group contracts by customer ID to make customer loyalty enrichments O(N) instead of O(N * M)
          const contractsByCustomer = new Map<string, any[]>();
          (contracts || []).forEach((c: any) => {
            if (c.customerId) {
              if (!contractsByCustomer.has(c.customerId)) {
                contractsByCustomer.set(c.customerId, []);
              }
              contractsByCustomer.get(c.customerId)!.push(c);
            }
          });

          const enrichedCustomers = (customers || []).map((c: any) => {
            const customerContracts = contractsByCustomer.get(c.id) || [];
            const loyalty = calculateCustomerLoyalty(c, customerContracts);
            return {
              ...c,
              ...loyalty,
            };
          });

          set({
            customers: enrichedCustomers,
            products,
            contracts,
            installments,
            receipts,
            inventoryMovements: invs,
            expenses,
            productCategories: categories,
            suppliers,
            settings: settingsObj,
            users: usersData || [],
            branches: branchesData || [],
            revenues: revenues || [],
            auditLogs: auditLogs || [],
            correctionRequests: correctionRequests || [],
          });
        } catch (error) {
          console.error("Failed to fetch initial data", error);
        }
      },

      updateSettings: async (newSettings: Record<string, string>) => {
        if (get().currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بتعديل الإعدادات");
          throw new Error("Unauthorized");
        }
        set((state) => ({ settings: { ...state.settings, ...newSettings } }));
        const batch = writeBatch(db);
        for (const [key, value] of Object.entries(newSettings)) {
          batch.set(doc(db, "settings", key), { value });
        }
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "settings");
          get().fetchInitialData();
        }
      },

      markNotificationAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n,
          ),
        })),

      addAuditLog: async (log) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fullLog: AuditLog = {
          ...log,
          id,
          actorId: currentUser.id,
          actorRole: currentUser.role,
          createdAt: new Date().toISOString(),
          source: "app",
        };
        // Background write
        setDoc(doc(db, "auditLogs", id), cleanUndefined({
          ...fullLog,
          createdAt: serverTimestamp(),
        })).catch(console.error);
        set((state) => ({ auditLogs: [fullLog, ...state.auditLogs] }));
      },

      createCorrectionRequest: async (req) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const id = `req-${Date.now()}`;
        const newReq: CorrectionRequest = {
          ...req,
          id,
          requestedBy: currentUser.id,
          requestedAt: new Date().toISOString(),
          status: "pending",
        };
        set((state) => ({
          correctionRequests: [...state.correctionRequests, newReq],
        }));
        try {
          await setDoc(doc(db, "correctionRequests", id), {
            ...newReq,
            requestedAt: serverTimestamp(),
          });
          toast.success("تم إرسال طلب التصحيح للمدير العام");
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            "correctionRequests",
          );
          get().fetchInitialData();
        }
      },

      reviewCorrectionRequest: async (id, status, note) => {
        const state = get();
        const currentUser = state.currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بمراجعة الطلبات");
          return;
        }
        const req = state.correctionRequests.find((r) => r.id === id);
        if (!req) return;

        const updates: Partial<CorrectionRequest> = {
          status,
          reviewNote: note,
          reviewedBy: currentUser.id,
          reviewedAt: new Date().toISOString(),
        };

        const batch = writeBatch(db);
        batch.update(doc(db, "correctionRequests", id), {
          ...updates,
          reviewedAt: serverTimestamp(),
        });

        if (status === "approved") {
          // Apply changes to target document
          batch.update(doc(db, req.collectionName, req.documentId), {
            ...req.proposedChanges,
            updatedBy: currentUser.id,
            updatedAt: serverTimestamp(),
          });

          // Log approval
          const logId = `log-appr-${Date.now()}`;
          batch.set(doc(db, "auditLogs", logId), {
            id: logId,
            actorId: currentUser.id,
            actorRole: currentUser.role,
            action: "CORRECTION_APPROVED",
            collectionName: req.collectionName,
            documentId: req.documentId,
            afterData: req.proposedChanges,
            createdAt: serverTimestamp(),
            source: "app",
            branchId: req.branchId,
          });
        }

        try {
          await batch.commit();
          toast.success(
            status === "approved"
              ? "تمت الموافقة وتطبيق التعديلات"
              : "تم رفض الطلب",
          );
          get().fetchInitialData();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            "correctionRequests/review",
          );
        }
      },

      addUser: async (user) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بإضافة مستخدمين");
          return;
        }
        const data = {
          ...user,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
        };
        set((state) => ({
          users: [...state.users.filter((u) => u.id !== data.id), data],
        }));
        try {
          await setDoc(doc(db, "users", data.id), data);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "users");
          get().fetchInitialData();
        }
      },

      updateUser: async (id, updates) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بتعديل المستخدمين");
          return;
        }
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, ...updates } : u,
          ),
        }));
        try {
          await updateDoc(doc(db, "users", id), updates as any);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, "users");
          get().fetchInitialData();
        }
      },

      addBranch: async (branch) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بإضافة فروع");
          return;
        }
        const data = {
          ...branch,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
        };
        set((state) => ({
          branches: [...state.branches.filter((b) => b.id !== data.id), data],
        }));
        try {
          await setDoc(doc(db, "branches", data.id), {
            ...data,
            createdAt: serverTimestamp(),
          });
          get().addAuditLog({
            action: "BRANCH_CREATE",
            collectionName: "branches",
            documentId: data.id,
            afterData: data,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "branches");
          get().fetchInitialData();
        }
      },

      updateBranch: async (id, updates) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بتعديل الفروع");
          return;
        }
        const state = get();
        const beforeData = state.branches.find((b) => b.id === id);
        set((state) => ({
          branches: state.branches.map((b) =>
            b.id === id ? { ...b, ...updates } : b,
          ),
        }));
        try {
          await updateDoc(doc(db, "branches", id), {
            ...updates,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id,
          } as any);
          get().addAuditLog({
            action: "BRANCH_UPDATE",
            collectionName: "branches",
            documentId: id,
            beforeData,
            afterData: updates,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, "branches");
          get().fetchInitialData();
        }
      },

      deleteBranch: async (id) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("غير مصرح لك بحذف الفروع");
          return;
        }
        // Soft delete branch
        set((state) => ({
          branches: state.branches.filter((b) => b.id !== id),
        }));
        try {
          await updateDoc(doc(db, "branches", id), {
            isActive: false,
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.id,
          } as any);
          get().addAuditLog({
            action: "BRANCH_DELETE",
            collectionName: "branches",
            documentId: id,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, "branches");
          get().fetchInitialData();
        }
      },

      addCustomer: async (customer) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const fileData = attachUserMetadata(customer, currentUser);
        const branchId = fileData.branchId || "default-branch";
        const year = new Date().getFullYear();
        let finalCode = "";

        try {
          await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, "counters", branchId);
            const counterSnap = await transaction.get(counterRef);

            let nextNum = 1;
            if (counterSnap.exists()) {
              const data = counterSnap.data();
              if (typeof data.nextCustomerNumber === "number") {
                nextNum = data.nextCustomerNumber;
              }
            }

            finalCode = `CUST-${year}-${String(nextNum).padStart(6, "0")}`;

            // Increment and set counter in the transaction
            transaction.set(
              counterRef,
              { nextCustomerNumber: nextNum + 1 },
              { merge: true },
            );

            // Set customer document atomically inside transaction
            const customerRef = doc(db, "customers", fileData.id);
            transaction.set(customerRef, {
              ...fileData,
              customerCode: finalCode,
              createdAt: serverTimestamp(),
            });
          });

          const localCustomer = {
            ...fileData,
            customerCode: finalCode,
            createdAt: new Date().toISOString(),
            lastPurchaseDate: null,
            contractsCountLast6Months: 0,
            isPreferredCustomer: false,
          };

          set((state) => ({
            customers: [
              ...state.customers.filter((c) => c.id !== localCustomer.id),
              localCustomer,
            ],
          }));

          get().addAuditLog({
            action: "CREATE",
            collectionName: "customers",
            documentId: localCustomer.id,
            afterData: localCustomer,
            branchId: localCustomer.branchId,
          });

          toast.success(`تم إضافة العميل بنجاح برمز: ${finalCode}`);
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `customers/${fileData.id}`,
          );
          get().fetchInitialData();
        }
      },

      updateCustomer: async (customer) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه التعديل مباشرة");
          return;
        }
        const state = get();
        const beforeData = state.customers.find((c) => c.id === customer.id);
        const data = attachUserMetadata(customer, currentUser, true);
        const firestoreData = { ...data, updatedAt: serverTimestamp() };
        set((state) => ({
          customers: state.customers.map((c) => (c.id === data.id ? data : c)),
        }));
        try {
          await updateDoc(doc(db, "customers", data.id), firestoreData as any);
          get().addAuditLog({
            action: "UPDATE",
            collectionName: "customers",
            documentId: data.id,
            beforeData,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `customers/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      deleteCustomer: async (id, reason = "No reason provided") => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        const state = get();
        const customer = state.customers.find((c) => c.id === id);
        if (!customer) return;

        const updates = {
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: currentUser.id,
          deleteReason: reason,
        };

        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }));
        try {
          await updateDoc(doc(db, "customers", id), {
            ...updates,
            deletedAt: serverTimestamp(),
          } as any);
          get().addAuditLog({
            action: "SOFT_DELETE",
            collectionName: "customers",
            documentId: id,
            beforeData: customer,
            branchId: customer.branchId,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
          get().fetchInitialData();
        }
      },

      addProduct: async (product) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;

        const data = cleanUndefined(attachUserMetadata(product, currentUser));
        const firestoreData = { ...data, createdAt: serverTimestamp() };
        set((state) => ({
          products: [...state.products.filter((p) => p.id !== data.id), data],
        }));
        try {
          await setDoc(doc(db, "products", data.id), firestoreData);
          get().addAuditLog({
            action: "CREATE",
            collectionName: "products",
            documentId: data.id,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `products/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      updateProduct: async (product) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه التعديل");
          return;
        }
        const state = get();
        const beforeData = state.products.find((p) => p.id === product.id);
        const data = cleanUndefined(attachUserMetadata(product, currentUser, true));
        const firestoreData = { ...data, updatedAt: serverTimestamp() };
        set((state) => ({
          products: state.products.map((p) => (p.id === data.id ? data : p)),
        }));
        try {
          await updateDoc(doc(db, "products", data.id), firestoreData as any);
          get().addAuditLog({
            action: "UPDATE",
            collectionName: "products",
            documentId: data.id,
            beforeData,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `products/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      deleteProduct: async (id, reason = "Deleted from inventory") => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        const state = get();
        const prod = state.products.find((p) => p.id === id);
        if (!prod) return;

        const updates = {
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: currentUser.id,
          deleteReason: reason,
        };

        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
        try {
          await updateDoc(doc(db, "products", id), {
            ...updates,
            deletedAt: serverTimestamp(),
          } as any);
          get().addAuditLog({
            action: "SOFT_DELETE",
            collectionName: "products",
            documentId: id,
            branchId: prod.branchId,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
          get().fetchInitialData();
        }
      },

      addProductCategory: async (category) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const data = attachUserMetadata(category, currentUser);
        const firestoreData = { ...data, createdAt: serverTimestamp() };
        set((state) => ({
          productCategories: [
            ...state.productCategories.filter((c) => c.id !== data.id),
            data,
          ],
        }));
        try {
          await setDoc(doc(db, "product_categories", data.id), firestoreData);
          get().addAuditLog({
            action: "CREATE",
            collectionName: "product_categories",
            documentId: data.id,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `product_categories/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      updateProductCategory: async (category) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه التعديل");
          return;
        }
        const state = get();
        const beforeData = state.productCategories.find(
          (c) => c.id === category.id,
        );
        const data = attachUserMetadata(category, currentUser, true);
        const firestoreData = { ...data, updatedAt: serverTimestamp() };
        set((state) => ({
          productCategories: state.productCategories.map((c) =>
            c.id === data.id ? data : c,
          ),
        }));
        try {
          await updateDoc(
            doc(db, "product_categories", data.id),
            firestoreData as any,
          );
          get().addAuditLog({
            action: "UPDATE",
            collectionName: "product_categories",
            documentId: data.id,
            beforeData,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `product_categories/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      deleteProductCategory: async (id, reason) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        set((state) => ({
          productCategories: state.productCategories.filter((c) => c.id !== id),
        }));
        try {
          await updateDoc(doc(db, "product_categories", id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.id,
            deleteReason: reason,
          } as any);
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `product_categories/${id}`,
          );
          get().fetchInitialData();
        }
      },

      addSupplier: async (supplier) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const data = attachUserMetadata(supplier, currentUser);
        const firestoreData = { ...data, createdAt: serverTimestamp() };
        set((state) => ({
          suppliers: [...state.suppliers.filter((s) => s.id !== data.id), data],
        }));
        try {
          await setDoc(doc(db, "suppliers", data.id), firestoreData);
          get().addAuditLog({
            action: "CREATE",
            collectionName: "suppliers",
            documentId: data.id,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `suppliers/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      updateSupplier: async (supplier) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه التعديل");
          return;
        }
        const state = get();
        const beforeData = state.suppliers.find((s) => s.id === supplier.id);
        const data = attachUserMetadata(supplier, currentUser, true);
        const firestoreData = { ...data, updatedAt: serverTimestamp() };
        set((state) => ({
          suppliers: state.suppliers.map((s) => (s.id === data.id ? data : s)),
        }));
        try {
          await updateDoc(doc(db, "suppliers", data.id), firestoreData as any);
          get().addAuditLog({
            action: "UPDATE",
            collectionName: "suppliers",
            documentId: data.id,
            beforeData,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `suppliers/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      deleteSupplier: async (id, reason) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        set((state) => ({
          suppliers: state.suppliers.filter((s) => s.id !== id),
        }));
        try {
          await updateDoc(doc(db, "suppliers", id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.id,
            deleteReason: reason,
          } as any);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `suppliers/${id}`);
          get().fetchInitialData();
        }
      },

      addExpense: async (expense) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const data = attachUserMetadata(expense, currentUser);
        set((state) => ({
          expenses: [...state.expenses.filter((e) => e.id !== data.id), data],
        }));
        try {
          await setDoc(doc(db, "expenses", data.id), {
            ...data,
            createdAt: serverTimestamp(),
          });
          get().addAuditLog({
            action: "EXPENSE_CREATE",
            collectionName: "expenses",
            documentId: data.id,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `expenses/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      updateExpense: async (expense) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه التعديل");
          return;
        }
        const state = get();
        const beforeData = state.expenses.find((e) => e.id === expense.id);
        const data = attachUserMetadata(expense, currentUser, true);
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === data.id ? data : e)),
        }));
        try {
          await updateDoc(doc(db, "expenses", data.id), {
            ...data,
            updatedAt: serverTimestamp(),
          } as any);
          get().addAuditLog({
            action: "EXPENSE_UPDATE",
            collectionName: "expenses",
            documentId: data.id,
            beforeData,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `expenses/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      deleteExpense: async (id, reason) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }));
        try {
          await updateDoc(doc(db, "expenses", id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.id,
            deleteReason: reason,
          } as any);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
          get().fetchInitialData();
        }
      },

      addRevenue: async (revenue) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        const data = attachUserMetadata(revenue, currentUser);
        set((state) => ({
          revenues: [...state.revenues.filter((r) => r.id !== data.id), data],
        }));
        try {
          await setDoc(doc(db, "revenues", data.id), {
            ...data,
            createdAt: serverTimestamp(),
          });
          get().addAuditLog({
            action: "REVENUE_CREATE",
            collectionName: "revenues",
            documentId: data.id,
            afterData: data,
            branchId: data.branchId,
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `revenues/${data.id}`,
          );
          get().fetchInitialData();
        }
      },

      deleteRevenue: async (id, reason) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        set((state) => ({
          revenues: state.revenues.filter((r) => r.id !== id),
        }));
        try {
          await updateDoc(doc(db, "revenues", id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.id,
            deleteReason: reason,
          } as any);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `revenues/${id}`);
          get().fetchInitialData();
        }
      },

      addContract: async (contract) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;

        const data = attachUserMetadata(contract, currentUser);
        const contractItems = data.items || [];

        // Use a Firestore Transaction to ensure consistency and unique numbers
        // But for UI speed we still do optimistic updates.
        // We'll implement a counters system in rules/store.

        // Validate stock
        for (const item of contractItems) {
          const prod = get().products.find((p) => p.id === item.productId);
          if (!prod || prod.stock < item.quantity) {
            const pName = prod ? prod.name : "Unknown";
            throw new Error(
              `الكمية المطلوبة من ${pName} غير متوفرة في المخزون`,
            );
          }
        }

        const isCash =
          data.contractType === "نقدي" || data.numberOfInstallments === 0;
        const newInstallments = isCash
          ? []
          : generateInstallments(data, currentUser);

        const movements: InventoryMovement[] = contractItems.map((item, idx) =>
          attachUserMetadata(
            {
              id: `mov-${Date.now()}-${idx}`,
              productId: item.productId,
              quantity: item.quantity,
              type: "out",
              date: data.startDate,
              referenceId: data.id,
              notes: isCash
                ? `بيع نقدي (فاتورة) رقم ${data.contractNumber}`
                : `بيع بموجب العقد رقم ${data.contractNumber}`,
            },
            currentUser,
          ),
        );

        const revenueRaw = isCash
          ? {
              id: `rev-sale-${Date.now()}`,
              name: `بيع نقدي - فاتورة ${data.contractNumber}`,
              category: "مبيعات نقدية",
              amount: data.totalContractAmount,
              date: data.startDate,
              paymentMethod: "نقدي",
              notes: `بيع: ${contractItems.length} منتجات للعميل ${data.customerId}`,
              referenceId: data.id,
            }
          : null;

        const revenueRecord: Revenue | null = revenueRaw
          ? attachUserMetadata(revenueRaw, currentUser)
          : null;

        set((state) => {
          let updatedProducts = [...state.products];
          for (const item of contractItems) {
            updatedProducts = updatedProducts.map((p) =>
              p.id === item.productId
                ? { ...p, stock: p.stock - item.quantity }
                : p,
            );
          }

          const customer = state.customers.find((c) => c.id === data.customerId);
          let updatedCustomers = [...state.customers];
          if (customer) {
            const updatedContracts = [...state.contracts, data];
            const loyalty = calculateCustomerLoyalty(customer, updatedContracts);
            updatedCustomers = updatedCustomers.map((c) =>
              c.id === customer.id ? { ...c, ...loyalty } : c,
            );
          }

          return {
            contracts: [...state.contracts, data],
            installments: [...state.installments, ...newInstallments],
            products: updatedProducts,
            customers: updatedCustomers,
            inventoryMovements: [...state.inventoryMovements, ...movements],
            revenues: revenueRecord
              ? [...state.revenues, revenueRecord]
              : state.revenues,
          };
        });

        const batch = writeBatch(db);
        const cleanContract = JSON.parse(JSON.stringify(data));
        batch.set(doc(db, "contracts", data.id), {
          ...cleanContract,
          createdAt: serverTimestamp(),
        });

        for (const inst of newInstallments) {
          batch.set(doc(db, "installments", inst.id), {
            ...inst,
            createdAt: serverTimestamp(),
          });
        }
        for (const mov of movements) {
          batch.set(doc(db, "inventoryMovements", mov.id), {
            ...mov,
            createdAt: serverTimestamp(),
          });
        }
        if (revenueRecord) {
          batch.set(doc(db, "revenues", revenueRecord.id), {
            ...revenueRecord,
            createdAt: serverTimestamp(),
          });
        }
        for (const item of contractItems) {
          batch.update(doc(db, "products", item.productId), {
            stock: increment(-item.quantity),
            updatedAt: serverTimestamp(),
          });
        }

        const activeCustomer = get().customers.find((c) => c.id === data.customerId);
        if (activeCustomer) {
          const updatedContracts = [...get().contracts, data];
          const loyalty = calculateCustomerLoyalty(activeCustomer, updatedContracts);
          batch.update(doc(db, "customers", activeCustomer.id), {
            ...loyalty,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id,
          });
        }

        // Log action
        const logId = `log-sale-${Date.now()}`;
        batch.set(doc(db, "auditLogs", logId), {
          id: logId,
          actorId: currentUser.id,
          actorRole: currentUser.role,
          action: isCash ? "CASH_SALE" : "CONTRACT_CREATE",
          collectionName: "contracts",
          documentId: data.id,
          afterData: data,
          createdAt: serverTimestamp(),
          source: "app",
          branchId: data.branchId,
        });

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "contracts/batch");
          get().fetchInitialData();
        }
      },

      cancelContract: async (id, reason) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه إلغاء العقود");
          return;
        }
        const state = get();
        const contract = state.contracts.find((c) => c.id === id);
        if (!contract || contract.status === "ملغى") return;

        const batch = writeBatch(db);
        const now = new Date().toISOString();

        // 1. Mark contract as cancelled
        batch.update(doc(db, "contracts", id), {
          status: "ملغى",
          cancelledAt: now,
          cancelledBy: currentUser.id,
          cancelReason: reason,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
        });

        // 2. Cancel unpaid installments
        const relatedInstallments = state.installments.filter(
          (i) => i.contractId === id,
        );
        for (const inst of relatedInstallments) {
          if (inst.status !== "مدفوع") {
            batch.update(doc(db, "installments", inst.id), {
              status: "ملغى",
              updatedAt: serverTimestamp(),
              updatedBy: currentUser.id,
            });
          }
        }

        // 3. Restore stock & create reversal inventory movements
        const contractItems = contract.items || [];
        for (const item of contractItems) {
          const movId = `mov-rev-${Date.now()}-${item.productId}`;
          const movement = attachUserMetadata(
            {
              id: movId,
              productId: item.productId,
              quantity: item.quantity,
              type: "in",
              date: format(new Date(), "yyyy-MM-dd"),
              referenceId: id,
              notes: `إرجاع مخزون بسبب إلغاء العقد ${contract.contractNumber}`,
            },
            currentUser,
          );

          batch.set(doc(db, "inventoryMovements", movId), {
            ...movement,
            createdAt: serverTimestamp(),
          });
          batch.update(doc(db, "products", item.productId), {
            stock: increment(item.quantity),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id,
          });
        }

        // 4. Audit Log
        const logId = `log-canc-${Date.now()}`;
        batch.set(doc(db, "auditLogs", logId), {
          id: logId,
          actorId: currentUser.id,
          actorRole: currentUser.role,
          action: "CONTRACT_CANCELLED",
          collectionName: "contracts",
          documentId: id,
          createdAt: serverTimestamp(),
          source: "app",
          branchId: contract.branchId,
          afterData: { reason },
        });

        try {
          await batch.commit();
          toast.success("تم إلغاء العقد وإرجاع المخزون");
          get().fetchInitialData();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, "contracts/cancel");
        }
      },

      deleteContract: async (id) => {
        const currentUser = get().currentUser;
        if (currentUser?.role !== "ceo") {
          toast.error("فقط المدير العام يمكنه الحذف");
          return;
        }
        const state = get();
        const contract = state.contracts.find((c) => c.id === id);
        if (!contract) return;

        try {
          await updateDoc(doc(db, "contracts", id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.id,
          } as any);
          get().fetchInitialData();
          toast.success("تم حذف العقد بنجاح (حذف منطقي)");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `contracts/${id}`);
        }
      },

      recordPayment: async (receipt) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;

        if (receipt.amount <= 0) {
          throw new Error("مبلغ الدفع يجب أن يكون أكبر من صفر");
        }
        const state = get();
        const targetInstallment = state.installments.find(
          (i) => i.id === receipt.installmentId,
        );
        if (!targetInstallment) throw new Error("القسط غير موجود");
        if (receipt.amount > targetInstallment.remainingAmount) {
          throw new Error(
            `مبلغ الدفع (${receipt.amount}) أكبر من المبلغ المتبقي (${targetInstallment.remainingAmount})`,
          );
        }

        const data = attachUserMetadata(receipt, currentUser);

        const incomeExpenseRaw = {
          id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `تحصيل أقساط - إيصال رقم ${data.id}`,
          category: "تحصيل أقساط",
          amount: data.amount,
          date: data.date,
          paymentMethod: data.method,
          notes: `تحصيل قسط للعقد ${data.contractId} - العميل: ${data.customerId}`,
          type: "in",
          referenceId: data.id,
        };
        const incomeExpense: Expense = attachUserMetadata(
          incomeExpenseRaw,
          currentUser,
        ) as Expense;

        set((state) => {
          const updatedInstallments = state.installments.map((inst) => {
            if (inst.id === data.installmentId) {
              const newPaid = inst.paidAmount + data.amount;
              const remaining = inst.amount - newPaid;
              return {
                ...inst,
                paidAmount: newPaid,
                remainingAmount: remaining,
                status: (remaining <= 0
                  ? "مدفوع"
                  : "مدفوع جزئياً") as InstallmentStatus,
                paymentDate: data.date,
              };
            }
            return inst;
          });

          const contractInstallments = updatedInstallments.filter(
            (i) => i.contractId === data.contractId,
          );
          const allPaid = contractInstallments.every(
            (i) => i.status === "مدفوع",
          );
          const updatedContracts = state.contracts.map((c) =>
            c.id === data.contractId && allPaid
              ? { ...c, status: "مكتمل" as ContractStatus }
              : c,
          );

          const existingIncome = state.expenses.find(
            (e) => e.referenceId === data.id,
          );
          const newExpenses = existingIncome
            ? state.expenses
            : [...state.expenses, incomeExpense];

          return {
            receipts: [...state.receipts, data],
            installments: updatedInstallments,
            expenses: newExpenses,
            contracts: updatedContracts,
          };
        });

        const batch = writeBatch(db);
        batch.set(doc(db, "receipts", data.id), {
          ...data,
          createdAt: serverTimestamp(),
        });

        const existingOnClient = get().expenses.find(
          (e) => e.referenceId === data.id,
        );
        if (!existingOnClient) {
          batch.set(doc(db, "expenses", incomeExpense.id), {
            ...incomeExpense,
            createdAt: serverTimestamp(),
          });
        }

        const updatedInst = get().installments.find(
          (i) => i.id === data.installmentId,
        );
        if (updatedInst) {
          batch.update(doc(db, "installments", updatedInst.id), {
            ...updatedInst,
            updatedBy: currentUser.id,
            updatedAt: serverTimestamp(),
          } as any);
        }

        const updatedContract = get().contracts.find(
          (c) => c.id === data.contractId,
        );
        if (updatedContract && updatedContract.status === "مكتمل") {
          batch.update(doc(db, "contracts", data.contractId), {
            status: "مكتمل",
            updatedBy: currentUser.id,
            updatedAt: serverTimestamp(),
          });
        }
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "receipts/batch");
          get().fetchInitialData();
        }
      },

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "qeist-storage",
      partialize: (state) => ({
        currentUser: state.currentUser,
        theme: state.theme,
      }),
    },
  ),
);

export const setStoreState = useStore.setState;
