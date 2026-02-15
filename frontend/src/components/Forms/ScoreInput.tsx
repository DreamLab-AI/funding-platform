// =============================================================================
// ScoreInput Component
// =============================================================================

import { useState, useEffect } from 'react';
import { Criterion, CriterionScore } from '../../types';

interface ScoreInputProps {
  criterion: Criterion;
  value?: Partial<CriterionScore>;
  onChange: (score: Partial<CriterionScore>) => void;
  disabled?: boolean;
  error?: string;
}

export function ScoreInput({
  criterion,
  value,
  onChange,
  disabled = false,
  error,
}: ScoreInputProps) {
  const [score, setScore] = useState<number | ''>(value?.score ?? '');
  const [comment, setComment] = useState(value?.comment ?? '');

  useEffect(() => {
    setScore(value?.score ?? '');
    setComment(value?.comment ?? '');
  }, [value]);

  const handleScoreChange = (newScore: number | '') => {
    setScore(newScore);
    onChange({
      criterionId: criterion.id,
      criterionName: criterion.name,
      score: typeof newScore === 'number' ? newScore : 0,
      maxScore: criterion.maxPoints,
      comment,
    });
  };

  const handleCommentChange = (newComment: string) => {
    setComment(newComment);
    onChange({
      criterionId: criterion.id,
      criterionName: criterion.name,
      score: typeof score === 'number' ? score : 0,
      maxScore: criterion.maxPoints,
      comment: newComment,
    });
  };

  const getScorePercentage = () => {
    if (typeof score !== 'number') return 0;
    return (score / criterion.maxPoints) * 100;
  };

  const getScoreColor = () => {
    const percentage = getScorePercentage();
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div
      className={`border rounded-lg p-4 ${
        error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Criterion Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-base font-medium text-gray-900">
              {criterion.name}
              {criterion.weight && (
                <span className="ml-2 text-sm text-gray-500">
                  (Weight: {criterion.weight}x)
                </span>
              )}
            </h4>
            {criterion.description && (
              <p className="mt-1 text-sm text-gray-500">{criterion.description}</p>
            )}
          </div>
          <span className="text-sm text-gray-500">
            Max: {criterion.maxPoints} points
          </span>
        </div>
      </div>

      {/* Score Input */}
      <div className="mb-4">
        <label
          htmlFor={`score-${criterion.id}`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Score <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center space-x-4">
          <input
            id={`score-${criterion.id}`}
            type="number"
            min={0}
            max={criterion.maxPoints}
            step={1}
            value={score}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                handleScoreChange('');
              } else {
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 0 && num <= criterion.maxPoints) {
                  handleScoreChange(num);
                }
              }
            }}
            disabled={disabled}
            className={`block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              disabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
            aria-describedby={`score-${criterion.id}-help`}
          />
          <span className={`text-lg font-medium ${getScoreColor()}`}>
            / {criterion.maxPoints}
          </span>

          {/* Score Slider */}
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={criterion.maxPoints}
              value={typeof score === 'number' ? score : 0}
              onChange={(e) => handleScoreChange(parseInt(e.target.value, 10))}
              disabled={disabled}
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
        <p
          id={`score-${criterion.id}-help`}
          className="mt-1 text-sm text-gray-500"
        >
          Enter a score between 0 and {criterion.maxPoints}
        </p>
      </div>

      {/* Comment Input */}
      <div>
        <label
          htmlFor={`comment-${criterion.id}`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Comments{' '}
          {criterion.commentsRequired ? (
            <span className="text-red-500">*</span>
          ) : (
            <span className="text-gray-400">(Optional)</span>
          )}
        </label>
        <textarea
          id={`comment-${criterion.id}`}
          rows={3}
          value={comment}
          onChange={(e) => handleCommentChange(e.target.value)}
          disabled={disabled}
          placeholder="Provide justification for your score..."
          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// ScoreInputGroup Component
// =============================================================================

interface ScoreInputGroupProps {
  criteria: Criterion[];
  values: Record<string, Partial<CriterionScore>>;
  onChange: (criterionId: string, score: Partial<CriterionScore>) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export function ScoreInputGroup({
  criteria,
  values,
  onChange,
  disabled = false,
  errors = {},
}: ScoreInputGroupProps) {
  const totalScore = Object.values(values).reduce(
    (sum, score) => sum + (score.score || 0),
    0
  );
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Assessment Criteria</h3>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Score</p>
          <p className="text-2xl font-bold text-primary-600">
            {totalScore} / {maxTotal}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {criteria.map((criterion) => (
          <ScoreInput
            key={criterion.id}
            criterion={criterion}
            value={values[criterion.id]}
            onChange={(score) => onChange(criterion.id, score)}
            disabled={disabled}
            error={errors[criterion.id]}
          />
        ))}
      </div>
    </div>
  );
}
