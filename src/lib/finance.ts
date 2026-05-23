
/**
 * Finance Logic Service
 * Centralized calculations for the installment system
 */

export interface InstallmentPreview {
  basePrice: number; // subtotal
  interestRate: number; // raw total rate (e.g. 25)
  totalInterest: number; // interestAmount
  totalContractAmount: number; // financedAmount + totalInterest
  financedAmount: number; // subtotal - downPayment
  installmentAmount: number; // totalContractAmount / months
}

export const FinanceService = {
  /**
   * Helper: Calculates the subtotal of items
   */
  calculateSubtotal: (items: { quantity: number; productPrice: number }[]): number => {
    return items.reduce((acc, item) => acc + (item.productPrice * item.quantity), 0);
  },

  /**
   * Helper: Calculates the financed amount (subtotal - downPayment)
   */
  calculateFinancedAmount: (subtotal: number, downPayment: number): number => {
    return Math.max(0, subtotal - downPayment);
  },

  /**
   * Helper: Calculates the total interest rate percentage depending on installments and settings
   */
  getInterestRate: (numberOfInstallments: number, settings: Record<string, string> | undefined): number => {
    if (numberOfInstallments <= 0) return 0;
    let totalRate = 25;
    if (numberOfInstallments <= 3) totalRate = parseFloat(settings?.profitRate3 || '10');
    else if (numberOfInstallments <= 6) totalRate = parseFloat(settings?.profitRate6 || '15');
    else if (numberOfInstallments <= 12) totalRate = parseFloat(settings?.profitRate12 || '25');
    else if (numberOfInstallments <= 18) totalRate = parseFloat(settings?.profitRate18 || '35');
    else if (numberOfInstallments <= 24) totalRate = parseFloat(settings?.profitRate24 || '45');
    else totalRate = parseFloat(settings?.profitRate36 || '60');
    return totalRate;
  },

  /**
   * Helper: Calculates interest amount on the financed amount ONLY (financedAmount * interestRate / 100)
   */
  calculateInterest: (financedAmount: number, interestRate: number): number => {
    return (financedAmount * interestRate) / 100;
  },

  /**
   * Helper: Calculates the monthly installment amount (totalContractAmount / numberOfInstallments)
   */
  calculateInstallmentAmount: (totalContractAmount: number, numberOfInstallments: number): number => {
    if (numberOfInstallments <= 0) return 0;
    return totalContractAmount / numberOfInstallments;
  },

  /**
   * Helper: Validates financials of a contract
   */
  validateContractFinancials: (contract: {
    contractType?: string;
    subtotal: number;
    downPayment: number;
    financedAmount: number;
    numberOfInstallments: number;
  }): { isValid: boolean; error?: string } => {
    if (contract.downPayment < 0) {
      return { isValid: false, error: 'الدفعة المقدمة لا يمكن أن تكون سالبة.' };
    }
    if (contract.downPayment > contract.subtotal) {
      return { isValid: false, error: 'الدفعة المقدمة لا يمكن أن تتجاوز إجمالي المنتجات.' };
    }
    if (contract.financedAmount < 0) {
      return { isValid: false, error: 'المبلغ الممول لا يمكن أن يكون سالباً.' };
    }
    const isInstallment = contract.contractType !== 'نقدي';
    if (isInstallment && contract.numberOfInstallments <= 0) {
      return { isValid: false, error: 'عدد الأقساط يجب أن يكون أكبر من الصفر بالنسبة لبيوع التقسيط.' };
    }
    return { isValid: true };
  },

  /**
   * Calculates the full breakdown of an installment contract
   */
  calculateContract: (
    subtotal: number,
    downPayment: number,
    numberOfInstallments: number,
    settings?: Record<string, string>
  ): InstallmentPreview => {
    const rawSubtotal = Math.max(0, subtotal);
    const rawDownPayment = Math.max(0, downPayment);
    const rawMonths = Math.max(0, numberOfInstallments);

    const financedAmount = FinanceService.calculateFinancedAmount(rawSubtotal, rawDownPayment);
    const interestRate = rawMonths > 0 ? FinanceService.getInterestRate(rawMonths, settings) : 0;
    const interestAmount = FinanceService.calculateInterest(financedAmount, interestRate);
    
    // For cash contracts, totalContractAmount is subtotal, interest is 0, installments is 0
    const totalContractAmount = rawMonths > 0 ? (financedAmount + interestAmount) : rawSubtotal;
    const installmentAmount = rawMonths > 0 ? FinanceService.calculateInstallmentAmount(totalContractAmount, rawMonths) : 0;

    return {
      basePrice: rawSubtotal,
      interestRate: interestRate,
      totalInterest: Math.round(interestAmount * 10) / 10,
      totalContractAmount: Math.round(totalContractAmount * 10) / 10,
      financedAmount: Math.round(financedAmount * 10) / 10,
      installmentAmount: Math.round(installmentAmount * 10) / 10,
    };
  },

  /**
   * Format numbers to 1 decimal place as requested by user previously
   */
  formatCurrency: (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount) + ' ج.م';
  },

  /**
   * Validates Egyptian National ID (Basic check: 14 digits)
   */
  isValidNationalId: (id: string) => /^[0-9]{14}$/.test(id),

  /**
   * Validates Phone Number (Basic check: starts with 01 and 11 digits)
   */
  isValidPhone: (phone: string) => /^(01)[0-9]{9}$/.test(phone),

  /**
   * Calculates the cost of a contract based on its items and current product costs.
   */
  calculateContractCost: (contract: any, products: any[]) => {
      let contractCost = 0;
      if (contract.items && contract.items.length > 0) {
        contract.items.forEach((item: any) => {
           const p = products.find((p: any) => p.id === item.productId);
           contractCost += (p?.costPrice || 0) * item.quantity;
        });
      } else if (contract.productId) {
         const p = products.find((p: any) => p.id === contract.productId);
         contractCost = (p?.costPrice || 0) * (contract.quantity || 1);
      }
      return contractCost;
  },

  /**
   * Calculates the expected profit of a contract
   */
  calculateContractProfit: (contract: any, products: any[]) => {
      const cost = FinanceService.calculateContractCost(contract, products);
      return (contract.totalContractAmount || 0) - cost;
  }
};
