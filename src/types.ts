export interface Field {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  nullable: boolean;
  unique: boolean;
}

export type UpdateFieldFn = (index: number, key: keyof Field, value: any) => void;
