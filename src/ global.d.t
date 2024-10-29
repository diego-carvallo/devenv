// src/global.d.ts
declare module 'ink-table' {
    import { FC } from 'react';
  
    interface TableProps {
      data: Array<Record<string, any>>;
    }
  
    const Table: FC<TableProps>;
    export default Table;
  }