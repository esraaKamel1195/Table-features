import {
  Component,
  computed,
  ElementRef,
  HostListener,
  OnInit,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CustomerService } from '../models/customerservice';
import { Customer, Representative } from '../models/customer';
import { ColumnsConfig, DataType } from '../models/ColumnsConfig';
import { FormsModule } from '@angular/forms';
import { MultiSelectChangeEvent, MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';

interface ContextMenuItemsMenu {
  label?: string;
  icon?: string;
  action?: () => void;
  items?: ContextMenuItemsMenu[];
  separator?: boolean;
}

// Grouped data structure for hierarchical display
export interface GroupedData {
  groupKey: string;
  groupValue: any;
  groupField: string;
  groupColumnLabel: string;
  level: number;
  items: Customer[] | GroupedData[]; // Can contain customers or sub-groups
  expanded: boolean;
  path: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
  type: DataType;
}

@Component({
  selector: 'app-custom-table',
  imports: [CommonModule, DragDropModule, FormsModule, MultiSelectModule, CheckboxModule],
  templateUrl: './custom-table.html',
  styleUrl: './custom-table.css',
  providers: [CustomerService],
})
export class CustomTable implements OnInit {
  customers: WritableSignal<Customer[]> = signal([]);
  private originalCustomers: Customer[] = [];
  loading: boolean = true;
  representatives!: Representative[];
  statuses!: any[];
  visible: WritableSignal<boolean> = signal(false);
  selectAll: WritableSignal<boolean> = signal(false);
  position = {
    x: 0,
    y: 0,
  };
  @ViewChild('table') table!: ElementRef<any>;
  @ViewChild('contextMenu') contextMenu!: ElementRef<HTMLDivElement>;

  columnsConfig: WritableSignal<ColumnsConfig[]> = signal([
    {
      field: 'id',
      label: 'Id',
      type: 'number',
      groupedBy: false,
      selected: false,
      width: 70,
      visible: true,
      fixed: 'left',
      disableVisiblity: true,
      rejectUnFixed: true,
    },
    {
      field: 'name',
      label: 'Name',
      type: 'string',
      groupedBy: false,
      width: 150,
      visible: true,
      disableVisiblity: true,
      rejectUnFixed: true,
    },
    {
      field: 'country',
      label: 'Country',
      type: 'string',
      groupedBy: false,
      operators: ['equals', 'gte', 'lte'],
      width: 150,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'company',
      label: 'Company',
      type: 'string',
      groupedBy: false,
      width: 150,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'date',
      label: 'Date',
      type: 'date',
      groupedBy: false,
      width: 150,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'activity',
      label: 'Activity',
      type: 'number',
      groupedBy: false,
      width: 100,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'status',
      label: 'Status',
      type: 'string',
      groupedBy: false,
      options: this.statuses,
      width: 120,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'representative',
      label: 'Representative',
      type: 'string',
      groupedBy: false,
      options: this.representatives,
      width: 150,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'verified',
      label: 'Verified',
      type: 'boolean',
      groupedBy: false,
      width: 100,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
    {
      field: 'balance',
      label: 'Balance',
      type: 'number',
      groupedBy: false,
      width: 100,
      visible: true,
      disableVisiblity: false,
      rejectUnFixed: false,
    },
  ]);
  items: ContextMenuItemsMenu[] = [];

  grouppedMode: WritableSignal<boolean> = signal(false);
  // Track which columns are grouped and their order
  groupedColumns: WritableSignal<string[]> = signal([]);

  // Store expanded/collapsed state for each group path
  expandedGroups: WritableSignal<Set<string>> = signal(new Set());

  selectedColumns: ColumnsConfig[] = [];

  // Computed grouped data based on groupedColumns
  groupedData: Signal<GroupedData[]> = computed(() => {
    const grouped = this.groupedColumns();
    if (grouped.length === 0) {
      return [];
    }
    return this.createGroupHierarchy(this.customers(), grouped, 0, '');
  });

  // Check if we're in grouped mode
  isGroupedMode: Signal<boolean> = computed(() => this.groupedColumns().length > 0);

  columnWidths: Record<string, number> = {};

  sortConfig: WritableSignal<SortConfig[]> = signal<SortConfig[]>([]);

  // Computed sorted data
  sortedData = computed(() => {
    const config = this.sortConfig();
    if (config.length === 0) return this.customers();

    return [...this.customers()].sort((a, b) => {
      for (const sort of config) {
        const aVal = a[sort.column as keyof ColumnsConfig];
        const bVal = b[sort.column as keyof ColumnsConfig];
        const comparison = this.compareValues(aVal, bVal, sort.type);

        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  });

  leftFixedColumns = computed(() =>
    this.columnsConfig()
      .filter((col) => col.fixed === 'left')
      .sort((a, b) => (a.fixedOrder || 0) - (b.fixedOrder || 0)),
  );

  rightFixedColumns = computed(() =>
    this.columnsConfig()
      .filter((col) => col.fixed === 'right')
      .sort((a, b) => (a.fixedOrder || 0) - (b.fixedOrder || 0)),
  );

  scrollableColumns = computed(() => this.columnsConfig().filter((col) => !col.fixed));

  private resizing = false;
  private startX = 0;
  private startWidth = 0;
  private currentColumn: string | null = null;

  constructor(private readonly customerService: CustomerService) {}

  ngOnInit(): void {
    // Initialization logic can go here
    this.customerService.getCustomersLarge().then((customers) => {
      this.customers.set([...customers]);
      this.originalCustomers = [...customers];
      this.loading = false;
      this.customers().forEach((customer) => (customer.date = new Date(<Date>customer.date)));
    });

    this.selectedColumns = this.getVisibleColumns();
    this.representatives = [
      { name: 'Amy Elsner', image: 'amyelsner.png' },
      { name: 'Anna Fali', image: 'annafali.png' },
      { name: 'Asiya Javayant', image: 'asiyajavayant.png' },
      { name: 'Bernardo Dominic', image: 'bernardodominic.png' },
      { name: 'Elwin Sharvill', image: 'elwinsharvill.png' },
      { name: 'Ioni Bowcher', image: 'ionibowcher.png' },
      { name: 'Ivan Magalhaes', image: 'ivanmagalhaes.png' },
      { name: 'Onyama Limba', image: 'onyamalimba.png' },
      { name: 'Stephen Shaw', image: 'stephenshaw.png' },
      { name: 'Xuxue Feng', image: 'xuxuefeng.png' },
    ];

    this.statuses = [
      { label: 'Unqualified', value: 'unqualified' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'New', value: 'new' },
      { label: 'Negotiation', value: 'negotiation' },
      { label: 'Renewal', value: 'renewal' },
      { label: 'Proposal', value: 'proposal' },
    ];
  }

  onColumnDrop(event: CdkDragDrop<ColumnsConfig[]>): void {
    const columns = [...this.columnsConfig()];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.columnsConfig.set(columns);

    setTimeout(() => {
      this.table?.nativeElement?.reset();
    }, 0);
  }

  openContextMenu(event: MouseEvent, column: ColumnsConfig): void {
    event.preventDefault();

    // Context menu logic can be implemented here
    this.items = [
      {
        label: 'Group by this column',
        icon: 'pi pi-filter',
        action: () => this.addGrouping(column),
      },
      {
        label: 'Remove from grouping',
        icon: 'pi pi-filter-slash',
        action: () => this.removeGrouping(column),
      },
      {
        label: 'Clear all grouping',
        icon: 'pi pi-times',
        action: () => this.clearAllGrouping(),
      },
      { separator: true },
      {
        label: 'Sort Ascending',
        icon: 'pi pi-sort-amount-up',
        action: () => this.sort('asc', column, event),
      },
      {
        label: 'Sort Descending',
        icon: 'pi pi-sort-amount-down',
        action: () => this.sort('desc', column, event),
      },
      { separator: true },
      {
        label: 'Fix this column left',
        icon: 'pi pi-arrow-left',
        action: () => this.fixColumns(column, 'left'),
      },
      {
        label: 'Fix this column right',
        icon: 'pi pi-arrow-right',
        action: () => this.fixColumns(column, 'right'),
      },
      {
        label: 'Unfix this column',
        icon: 'pi pi-thumbtack',
        action: () => this.unFixColumn(column),
      },
      {
        label: 'Unfix all columns',
        icon: 'pi pi-thumbtack',
        action: () => this.unFixAllColumns(),
      },
      { separator: true },
      {
        label: 'Hide Column',
        icon: 'pi pi-eye-slash',
        action: () => this.hideColumn(column),
      },
    ];

    this.position.x = event.clientX;
    this.position.y = event.clientY;
    this.visible.set(true);
  }

  createGroupHierarchy(
    customers: Customer[],
    groupedColumns: string[],
    level: number,
    parentPath: string,
  ): GroupedData[] {
    if (groupedColumns.length === 0 || customers.length === 0 || level >= groupedColumns.length) {
      return [];
    }

    const currentField = groupedColumns[level];
    const column = this.columnsConfig().find((col) => col.field === currentField);
    if (!column) {
      return [];
    }

    const groupsMap: Map<any, Customer[]> = new Map();

    customers.forEach((customer) => {
      const value = this.getFieldValue(customer, currentField);
      const groupKey = this.getGroupKey(value);
      // const groupKey = customer[currentField as keyof Customer];
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey)!.push(customer);
    });

    const groupedData: GroupedData[] = [];

    groupsMap.forEach((groupedItems, groupKey) => {
      const path = parentPath ? `${parentPath}|${groupKey}` : groupKey;
      const grouped: GroupedData = {
        groupKey: groupKey,
        groupField: currentField,
        groupColumnLabel: column.label,
        groupValue: this.getFieldValue(groupedItems[0], currentField),
        level: level,
        items:
          level === groupedColumns.length - 1
            ? groupedItems
            : this.createGroupHierarchy(
                groupedItems,
                groupedColumns,
                level + 1,
                parentPath + '|' + groupKey,
              ),
        expanded: this.expandedGroups().has(path),
        path: path,
      };

      groupedData.push(grouped);
    });

    return groupedData;
  }

  getFieldValue(customer: Customer, field: string): any {
    if (field.includes('.')) {
      return field.split('.').reduce((obj, key) => (obj as Customer)[key], customer);
    }
    return customer[field as keyof Customer];
  }

  getGroupKey(value: any): string {
    if (value == null) return '__null__';
    if (typeof value === 'object') {
      return value.name || JSON.stringify(value);
    }
    return String(value);
  }

  addGrouping(column: ColumnsConfig): void {
    this.grouppedMode.set(true);
    const updatedColumns = this.columnsConfig().map((col) =>
      col.field === column.field ? { ...col, groupedBy: true } : col,
    );
    this.columnsConfig.set(updatedColumns);

    if (!this.groupedColumns().includes(column.field)) {
      this.groupedColumns.set([...this.groupedColumns(), column.field]);
      this.sort(column.sortedBy || 'asc', column, new MouseEvent('click'));
    }
    this.visible.set(false);
  }

  removeGrouping(column: ColumnsConfig): void {
    const updatedColumns = this.columnsConfig().map((col) =>
      col.field === column.field ? { ...col, groupedBy: false } : col,
    );
    this.columnsConfig.set(updatedColumns);
    this.visible.set(false);
    this.groupedColumns.set(this.groupedColumns().filter((field) => field !== column.field));
    if (this.groupedColumns().length === 0) {
      this.grouppedMode.set(false);
    }
  }

  clearAllGrouping(): void {
    this.grouppedMode.set(false);
    const updatedColumns = this.columnsConfig().map((col) => ({ ...col, groupedBy: false }));
    this.columnsConfig.set(updatedColumns);
    this.visible.set(false);
    this.groupedColumns.set([]);
  }

  sort(order: 'asc' | 'desc', column: ColumnsConfig, event: MouseEvent): void {
    const updatedColumns = this.columnsConfig().map((col) =>
      col.field === column.field ? { ...col, sortedBy: order } : col,
    );
    this.columnsConfig.set(updatedColumns);

    if (event.ctrlKey || event.metaKey) {
      this.sortConfig.update((prev) => prev.filter((sort) => sort.column !== column.field));
      return;
    }

    if (event.shiftKey) {
      this.sortConfig.update((prev) => {
        const existing = prev.find((sort) => sort.column === column.field);
        if (existing) {
          return prev.map((sort) => {
            return sort.column === column.field ? { ...sort, direction: order } : sort;
          });
        } else {
          return [...prev, { column: column.field, direction: order, type: column.type }];
        }
      });
    } else {
      this.sortConfig.set([{ column: column.field, direction: order, type: column.type }]);
    }
    this.visible.set(false);
  }

  // Type-aware comparison
  private compareValues(a: any, b: any, type: DataType): number {
    // Handle null/undefined
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;

    switch (type) {
      case 'number':
        return a - b;

      case 'string':
        return a.toString().localeCompare(b.toString(), undefined, {
          numeric: true,
          sensitivity: 'base',
        });

      case 'date':
        return new Date(a).getTime() - new Date(b).getTime();

      case 'boolean':
        return a === b ? 0 : a ? -1 : 1;

      default:
        return String(a).localeCompare(String(b));
    }
  }

  getSortIndex(columnField: string): number {
    return this.sortConfig().findIndex((sort) => sort.column === columnField);
  }

  getSortDirection(columnField: string): 'asc' | 'desc' | null {
    const sort = this.sortConfig().find((sort) => sort.column === columnField);
    return sort ? sort.direction : null;
  }

  toggleGroup(path: string): void {
    const expanded = new Set(this.expandedGroups());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    this.expandedGroups.set(expanded);
  }

  expandAll(): void {
    const allGroupPaths: Set<string> = new Set();

    const collectGroupPaths = (groups: GroupedData[]) => {
      groups?.forEach((group) => {
        allGroupPaths.add(group.path);
        if (this.isCustomerArray(group.items) === false) {
          collectGroupPaths(group.items as GroupedData[]);
        }
      });
    };

    collectGroupPaths(this.groupedData());
    this.expandedGroups.set(allGroupPaths);
  }

  collapseAll(): void {
    this.expandedGroups.set(new Set());
  }

  isCustomerArray(items: Customer[] | GroupedData[]): items is Customer[] {
    return items?.length > 0 && !('path' in items[0]);
  }

  formatDisplayValue(value: any, field: string): string {
    const column = this.columnsConfig().find((c) => c.field === field);

    if (value == null) return 'N/A';

    if (column?.type === 'date' && value instanceof Date) {
      return value.toLocaleDateString();
    }

    if (typeof value === 'object') {
      return value.name || JSON.stringify(value);
    }

    return String(value);
  }

  onResizeStart(event: MouseEvent, columnField: string): void {
    event.preventDefault();
    event.stopPropagation();
    // Implement resize logic here
    this.resizing = true;
    this.startX = event.pageX;
    this.startWidth = this.columnWidths[columnField] || 150;
    this.currentColumn = columnField;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseEnd);
  }

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.resizing || !this.currentColumn) return;
    const diff = event.pageX - this.startX;
    const newWidth = Math.max(50, this.startWidth + diff);
    this.columnWidths[this.currentColumn] = newWidth;

    // Trigger change detection if necessary
    this.columnWidths = { ...this.columnWidths };

    this.columnsConfig.update((cols) =>
      cols.map((col) => (col.field === this.currentColumn ? { ...col, width: newWidth } : col)),
    );
  };

  private readonly onMouseEnd = (event: MouseEvent) => {
    this.resizing = false;
    this.currentColumn = null;

    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseEnd);
  };

  clear() {
    this.customers.set([...this.originalCustomers]);
    this.sortConfig.set([]);
    this.groupedColumns.set([]);
    this.grouppedMode.set(false);
    this.expandedGroups.set(new Set());
    this.columnsConfig.update((cols) =>
      cols.map((col) => ({ ...col, visible: true, groupedBy: false, sortedBy: undefined })),
    );
  }

  hideColumn(column: ColumnsConfig): void {
    this.visible.set(false);
    const updatedColumns = this.columnsConfig().map((col) =>
      col.field === column.field ? { ...col, visible: false } : col,
    );
    this.columnsConfig.set(updatedColumns);
  }

  getVisibleColumns(): ColumnsConfig[] {
    return this.columnsConfig().filter(
      (col) => col.visible !== false && !this.groupedColumns().includes(col.field),
    );
  }

  onColumnVisiblityChange(event: MultiSelectChangeEvent | ColumnsConfig[]): void {
    const selectedFields =
      Array.isArray(event) && 'field' in event[0]
        ? (event as ColumnsConfig[]).map((col) => col.field)
        : (event as MultiSelectChangeEvent).value.map((col: ColumnsConfig) => col.field);
    const updatedColumns = this.columnsConfig().map((col) => ({
      ...col,
      visible: selectedFields.includes(col.field),
    }));
    this.columnsConfig.set(updatedColumns);
  }

  selectAllChange(event: any): void {
    const isSelected = event.checked;
    const updatedColumns = this.columnsConfig().map((col) =>
      col.field === 'id' ? { ...col, selected: isSelected } : col,
    );
    this.columnsConfig.set(updatedColumns);
    const updatedCustomers = this.customers().map((cust) => ({ ...cust, selected: isSelected }));
    this.customers.set(updatedCustomers);
  }

  selectTableData(event: any, customer: Customer): void {
    const isSelected = event.checked;
    const updatedCustomers = this.customers().map((cust) =>
      cust.id === customer.id ? { ...cust, selected: isSelected } : cust,
    );
    this.customers.set(updatedCustomers);
  }

  fixColumns(column: ColumnsConfig, position: 'left' | 'right' | null): void {
    this.visible.set(false);
    this.columnsConfig.update((cols) => {
      if (position === null) {
        return cols.map((col) =>
          col.field === column.field ? { ...col, fixed: null, fixedOrder: undefined } : col,
        );
      }

      const fixedCols = cols.filter((col) => col.fixed === position);
      const fixedOrder = fixedCols.length;

      return cols.map((col) =>
        col.field === column.field ? { ...col, fixed: position, fixedOrder: fixedOrder } : col,
      );
    });
  }

  unFixColumn(column: ColumnsConfig): void {
    this.visible.set(false);
    const updatedColumns = this.columnsConfig().map((col) =>
      col.field === column.field ? { ...col, fixed: null, fixedOrder: undefined } : col,
    );
    this.columnsConfig.set(updatedColumns);
  }

  unFixAllColumns(): void {
    this.visible.set(false);
    const updatedColumns = this.columnsConfig().map((col) => ({
      ...col,
      fixed: null,
      fixedOrder: undefined,
    }));
    this.columnsConfig.set(updatedColumns);
  }

  getLeftOffset(columnIndex: number): string {
    let offset = 0;
    const leftCols = this.leftFixedColumns();
    for (let i = 0; i < columnIndex && i < leftCols.length; i++) {
      offset += leftCols[i].width || 100;
    }
    return `${offset}px`;
  }

  getRightOffset(columnIndex: number): string {
    let offset = 0;
    const rightCols = this.rightFixedColumns();
    for (let i = rightCols.length - 1; i > columnIndex; i--) {
      offset += rightCols[i].width || 100;
    }
    return `${offset}px`;
  }

  // close on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (
      this.visible &&
      this.contextMenu &&
      !this.contextMenu.nativeElement.contains(event.target as Node)
    ) {
      this.visible.set(false);
    }
  }

  // close on ESC
  @HostListener('document:keydown.escape')
  onEsc() {
    this.visible.set(false);
  }
}
