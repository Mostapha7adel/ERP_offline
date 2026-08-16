export interface CurrencyRate {
  id: string;
  code: string;
  name?: string;
  symbol?: string;
  /** Units of the base currency per 1 unit of this currency. */
  rate: number;
  isBase: boolean;
  createdAt: string;
  updatedAt: string;
}