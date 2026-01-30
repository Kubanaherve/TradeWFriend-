import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerSuggestion {
  name: string;
  phone: string | null;
}

export function useCustomerSuggestions() {
  const [customers, setCustomers] = useState<CustomerSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("name, phone")
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Get unique customers by name
        const uniqueCustomers = data.reduce((acc, customer) => {
          const existing = acc.find(c => c.name.toLowerCase() === customer.name.toLowerCase());
          if (!existing) {
            acc.push({ name: customer.name, phone: customer.phone });
          }
          return acc;
        }, [] as CustomerSuggestion[]);
        
        setCustomers(uniqueCustomers);
      }
      setIsLoading(false);
    };

    fetchCustomers();
  }, []);

  const getSuggestions = useMemo(() => {
    return (query: string): CustomerSuggestion[] => {
      if (!query.trim()) return [];
      const lowerQuery = query.toLowerCase();
      return customers.filter(c => 
        c.name.toLowerCase().includes(lowerQuery)
      ).slice(0, 5);
    };
  }, [customers]);

  const getCustomerByName = (name: string): CustomerSuggestion | undefined => {
    return customers.find(c => c.name.toLowerCase() === name.toLowerCase());
  };

  return { customers, getSuggestions, getCustomerByName, isLoading };
}
