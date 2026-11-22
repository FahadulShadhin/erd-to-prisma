export interface Field {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface DiagramListItem {
  id: string;
  name: string;
}

export type UpdateFieldFn = (index: number, key: keyof Field, value: any) => void;
