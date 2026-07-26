import { useWalletApp, useWalletPortfolioState } from '../Context'
import { portfolioCurrencies } from '../../helpers/walletPortfolio'

const portfolioCurrencyNames: Record<string, string> = {
  AUD: 'Australian Dollar',
  BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc',
  DKK: 'Danish Krone',
  EUR: 'Euro',
  GBP: 'Pound Sterling',
  HKD: 'Hong Kong Dollar',
  INR: 'Indian Rupee',
  JPY: 'Japanese Yen',
  MXN: 'Mexican Peso',
  NOK: 'Norwegian Krone',
  PLN: 'Polish Zloty',
  SEK: 'Swedish Krona',
  SGD: 'Singapore Dollar',
  USD: 'US Dollar'
}

export const CurrencySettingsPanel = (): JSX.Element => {
  const { isBusy } = useWalletApp()
  const { portfolioCurrency, setPortfolioCurrency } =
    useWalletPortfolioState()

  const currenciesSettingsPanel = (
    <section className='settings-card'>
      <div className='settings-card-heading'>
        <div>
          <h2>Currency</h2>
          <p>Choose the currency used to value this wallet.</p>
        </div>
      </div>
      <label className='currency-select-field'>
        Display currency
        <select
          value={portfolioCurrency}
          onChange={event => setPortfolioCurrency(event.target.value as typeof portfolioCurrency)}
          disabled={isBusy}
        >
          {portfolioCurrencies.map(currency => (
            <option key={currency} value={currency}>
              {currency} - {portfolioCurrencyNames[currency] ?? currency}
            </option>
          ))}
        </select>
      </label>
    </section>
  )

  return currenciesSettingsPanel
}
