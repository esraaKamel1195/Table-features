export type DataType = 'string' | 'number' | 'date' | 'select' | 'boolean';

export interface ColumnsConfig {
  field: string; // Data field (e.g. "name")
  label: string; // UI label
  type: DataType; // Control type
  operators?: string[]; // (optional) equal, contains...
  options?: any[]; // For selects
  sortedBy?: 'asc' | 'desc';
  sortMode?: 'single' | 'multiple';
  sortOrder?: number;
  width?: number;
  allowDrag?: boolean;
  dragable?: boolean;
  filter?: boolean; // Whether to include in filter builder
  selected?: boolean;
  groupedBy?: boolean;
  visible?: boolean;
  disableVisiblity?: boolean;
  fixed?: 'left' | 'right' | null;
  fixedOrder?: number;
  rejectUnFixed?: boolean;
}
