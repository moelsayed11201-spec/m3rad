const fs = require('fs');

let content = fs.readFileSync('src/store.ts', 'utf8');

content = content.replace(
  /addCustomer: \(customer\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `addCustomer: async (customer) => {
        set((state) => ({ 
          customers: [...state.customers.filter(c => c.id !== customer.id), customer] 
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await setDoc(doc(db, 'customers', customer.id), { ...customer, userId: auth.currentUser.uid });
        }
      },`
);

content = content.replace(
  /updateCustomer: \(customer\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `updateCustomer: async (customer) => {
        set((state) => ({
          customers: state.customers.map(c => c.id === customer.id ? customer : c)
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, updateDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await updateDoc(doc(db, 'customers', customer.id), { ...customer, userId: auth.currentUser.uid });
        }
      },`
);

content = content.replace(
  /deleteCustomer: \(id\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `deleteCustomer: async (id) => {
        set((state) => ({
          customers: state.customers.filter(c => c.id !== id)
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await deleteDoc(doc(db, 'customers', id));
        }
      },`
);

content = content.replace(
  /addProduct: \(product\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `addProduct: async (product) => {
        set((state) => ({
          products: [...state.products.filter(p => p.id !== product.id), product]
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await setDoc(doc(db, 'products', product.id), { ...product, userId: auth.currentUser.uid });
        }
      },`
);

content = content.replace(
  /updateProduct: \(product\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `updateProduct: async (product) => {
        set((state) => ({
          products: state.products.map(p => p.id === product.id ? product : p)
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, updateDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await updateDoc(doc(db, 'products', product.id), { ...product, userId: auth.currentUser.uid });
        }
      },`
);

content = content.replace(
  /deleteProduct: \(id\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `deleteProduct: async (id) => {
        set((state) => ({
          products: state.products.filter(p => p.id !== id)
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await deleteDoc(doc(db, 'products', id));
        }
      },`
);

content = content.replace(
  /addContract: \(contract\) => set\(\(state\) => \{([\s\S]*?)return \{[\s\S]*?\};\n\s*\}\),/,
  `addContract: async (contract) => {
        const newInstallments = generateInstallments(contract);
        set((state) => {
          const movement = {
            id: \`mov-\${Date.now()}\`, productId: contract.productId, quantity: contract.quantity,
            type: 'out' as const, date: contract.startDate, referenceId: contract.id,
            notes: \`بيع بموجب العقد رقم \${contract.contractNumber}\`
          };
          const updatedProducts = state.products.map(p => p.id === contract.productId ? { ...p, stock: p.stock - contract.quantity } : p);
          return { 
            contracts: [...state.contracts, contract],
            installments: [...state.installments, ...newInstallments],
            products: updatedProducts,
            inventoryMovements: [...state.inventoryMovements, movement]
          };
        });

        const { auth, db } = await import('@/lib/firebase');
        const { doc, setDoc, writeBatch } = await import('firebase/firestore');
        if (auth.currentUser) {
          const batch = writeBatch(db);
          batch.set(doc(db, 'contracts', contract.id), { ...contract, userId: auth.currentUser.uid });
          for (const inst of newInstallments) {
            batch.set(doc(db, 'installments', inst.id), { ...inst, userId: auth.currentUser.uid });
          }
          await batch.commit();
        }
      },`
);

content = content.replace(
  /deleteContract: \(id\) => set\(\(state\) => \(\{[\s\S]*?\}\)\),/,
  `deleteContract: async (id) => {
        set((state) => ({
          contracts: state.contracts.filter(c => c.id !== id),
          installments: state.installments.filter(i => i.contractId !== id)
        }));
        const { auth, db } = await import('@/lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        if (auth.currentUser) {
          await deleteDoc(doc(db, 'contracts', id));
          // installments deletion skipped for now, would need a query
        }
      },`
);

content = content.replace(
  /recordPayment: \(receipt\) => set\(\(state\) => \{([\s\S]*?)return \{[\s\S]*?\};\n\s*\}\),/,
  `recordPayment: async (receipt) => {
        set((state) => {
          const updatedInstallments = state.installments.map(inst => {
            if (inst.id === receipt.installmentId) {
              const newPaid = inst.paidAmount + receipt.amount;
              const remaining = inst.amount - newPaid;
              return {
                ...inst, paidAmount: newPaid, remainingAmount: remaining,
                status: (remaining <= 0 ? 'مدفوع' : 'مدفوع جزئياً') as InstallmentStatus,
                paymentDate: receipt.date
              };
            }
            return inst;
          });
          return {
            receipts: [...state.receipts, receipt],
            installments: updatedInstallments
          };
        });
        
        const { auth, db } = await import('@/lib/firebase');
        const { doc, setDoc, updateDoc } = await import('firebase/firestore');
        const state = get();
        if (auth.currentUser) {
          await setDoc(doc(db, 'receipts', receipt.id), { ...receipt, userId: auth.currentUser.uid });
          const updatedInst = state.installments.find(i => i.id === receipt.installmentId);
          if (updatedInst) await updateDoc(doc(db, 'installments', updatedInst.id), { ...updatedInst });
        }
      },`
);


fs.writeFileSync('src/store.ts', content, 'utf8');
