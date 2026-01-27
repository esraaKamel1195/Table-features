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
  fixed?: boolean;
  width?: number;
  allowUnFix?: boolean;
  allowDrag?: boolean;
  dragable?: boolean;
  filter?: boolean; // Whether to include in filter builder
  visible?: boolean;
  groupedBy?: boolean;
  disableVisiblity?: boolean;
  rejectUnFixed?: boolean;
}
