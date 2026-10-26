import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...props
}) => {
  const [internalTab, setInternalTab] = React.useState<string>(defaultValue || '');

  const activeTab = value !== undefined ? value : internalTab;

  const setActiveTab = React.useCallback(
    (val: string) => {
      if (value === undefined) {
        setInternalTab(val);
      }
      onValueChange?.(val);
    },
    [value, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center justify-start rounded-xl bg-slate-900/90 p-1.5 text-slate-400 border border-slate-800 gap-1',
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) {
      throw new Error('TabsTrigger must be used within Tabs');
    }

    const isActive = context.activeTab === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => context.setActiveTab(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
          isActive
            ? 'bg-slate-800 text-cyan-400 shadow-sm border border-cyan-500/30 font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) {
      throw new Error('TabsContent must be used within Tabs');
    }

    if (context.activeTab !== value) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn('mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';
