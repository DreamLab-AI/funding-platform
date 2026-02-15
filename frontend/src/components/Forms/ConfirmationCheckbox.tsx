// =============================================================================
// ConfirmationCheckbox Component
// =============================================================================

import { ConfirmationType } from '../../types';

interface ConfirmationCheckboxProps {
  type: ConfirmationType;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  guidanceUrl?: string;
  ediUrl?: string;
  error?: string;
}

const confirmationLabels: Record<ConfirmationType, { title: string; description: string }> = {
  [ConfirmationType.GUIDANCE_READ]: {
    title: 'I have read and understood the guidance',
    description:
      'I confirm that I have read and understood all guidance documentation and eligibility criteria for this funding call.',
  },
  [ConfirmationType.EDI_COMPLETED]: {
    title: 'I have completed the EDI monitoring form',
    description:
      'I confirm that I have completed the Equality, Diversity and Inclusion (EDI) monitoring form as required.',
  },
  [ConfirmationType.DATA_SHARING_CONSENT]: {
    title: 'I consent to data sharing',
    description:
      'I consent to my application data being shared with assessors and relevant parties for the purposes of evaluation. Data will be handled in accordance with GDPR and our privacy policy.',
  },
};

export function ConfirmationCheckbox({
  type,
  checked,
  onChange,
  required = true,
  disabled = false,
  guidanceUrl,
  ediUrl,
  error,
}: ConfirmationCheckboxProps) {
  const { title, description } = confirmationLabels[type];

  const getExternalLink = () => {
    if (type === ConfirmationType.GUIDANCE_READ && guidanceUrl) {
      return (
        <a
          href={guidanceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-500 underline"
        >
          View guidance document
        </a>
      );
    }
    if (type === ConfirmationType.EDI_COMPLETED && ediUrl) {
      return (
        <a
          href={ediUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-500 underline"
        >
          Complete EDI form
        </a>
      );
    }
    return null;
  };

  return (
    <div
      className={`relative flex items-start p-4 rounded-lg border ${
        error
          ? 'border-red-300 bg-red-50'
          : checked
          ? 'border-primary-200 bg-primary-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center h-5">
        <input
          id={`confirmation-${type}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={`h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          aria-describedby={`${type}-description`}
        />
      </div>
      <div className="ml-3 flex-1">
        <label
          htmlFor={`confirmation-${type}`}
          className={`font-medium ${
            disabled ? 'text-gray-400' : 'text-gray-900'
          } ${!disabled && 'cursor-pointer'}`}
        >
          {title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <p
          id={`${type}-description`}
          className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-500'} mt-1`}
        >
          {description}
        </p>
        {getExternalLink() && (
          <p className="text-sm mt-2">{getExternalLink()}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ConfirmationCheckboxGroup Component
// =============================================================================

interface ConfirmationCheckboxGroupProps {
  requiredConfirmations: ConfirmationType[];
  values: Record<ConfirmationType, boolean>;
  onChange: (type: ConfirmationType, checked: boolean) => void;
  disabled?: boolean;
  guidanceUrl?: string;
  ediUrl?: string;
  errors?: Partial<Record<ConfirmationType, string>>;
}

export function ConfirmationCheckboxGroup({
  requiredConfirmations,
  values,
  onChange,
  disabled = false,
  guidanceUrl,
  ediUrl,
  errors = {},
}: ConfirmationCheckboxGroupProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Required Confirmations</h3>
      <p className="text-sm text-gray-500">
        Please confirm the following before submitting your application.
      </p>
      <div className="space-y-3">
        {requiredConfirmations.map((type) => (
          <ConfirmationCheckbox
            key={type}
            type={type}
            checked={values[type] || false}
            onChange={(checked) => onChange(type, checked)}
            required={true}
            disabled={disabled}
            guidanceUrl={guidanceUrl}
            ediUrl={ediUrl}
            error={errors[type]}
          />
        ))}
      </div>
    </div>
  );
}
