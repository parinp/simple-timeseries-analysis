'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
  Link,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TimeSeriesData } from '../utils/types';
import { analyzeData, checkApiHealth, getShapDescriptions, MLAnalysisResults } from '../utils/mlService';
import { useData } from '../utils/DataContext';

interface MLAnalysisProps {
  data: TimeSeriesData[];
  dateColumn: string;
  targetColumn: string;
}

const MLAnalysis: React.FC<MLAnalysisProps> = ({
  data,
  dateColumn,
  targetColumn,
}) => {
  // Try to use DataContext, but fall back to props if not available
  const dataContext = useData();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MLAnalysisResults | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [checkingApi, setCheckingApi] = useState<boolean>(false);
  const [analysisInitiated, setAnalysisInitiated] = useState<boolean>(false);
  
  const shapDescriptions = getShapDescriptions();
  
  // Memoize the data preparation for ML analysis
  const preparedData = useMemo(() => {
    // Determine which data to use - context data if available, otherwise prop data
    const sourceData = dataContext?.allData?.length ? dataContext.allData : data;
    
    console.log(`Using ${sourceData.length} data points for ML analysis`);
    
    // Create a deep copy of the data to avoid modifying the original
    const dataCopy = sourceData.map(item => {
      // Create a new object with all properties from the original item
      return { ...item };
    });
    
    // Normalize the data to ensure consistent column names
    const normalizedData = dataCopy.map(item => {
      // Remove 'open' feature if present
      if ('open' in item) {
        delete item.open;
      }
      
      return item;
    });
    
    return normalizedData;
  }, [dataContext, data]);
  
  // Define handleAnalyze with useCallback to avoid dependency issues
  const handleAnalyze = useCallback(async () => {
    if (loading) return; // Prevent multiple simultaneous calls
    
    setLoading(true);
    setError(null);
    setAnalysisInitiated(true);
    
    try {
      console.log(`Analyzing ${preparedData.length} data points with machine learning`);
      console.log(`Using date column: "${dateColumn}" and target column: "${targetColumn}"`);
      
      // Check if data has the specified columns
      if (preparedData.length > 0) {
        const sampleRow = preparedData[0];
        const availableColumns = Object.keys(sampleRow);
        console.log('Available columns:', availableColumns);
        
        // Try to find the date column (case-insensitive)
        const dateColumnLower = dateColumn.toLowerCase();
        const matchingDateColumns = availableColumns.filter(col => 
          col.toLowerCase() === dateColumnLower
        );
        
        // Try to find the target column (case-insensitive)
        const targetColumnLower = targetColumn.toLowerCase();
        const matchingTargetColumns = availableColumns.filter(col => 
          col.toLowerCase() === targetColumnLower
        );
        
        if (matchingDateColumns.length === 0) {
          throw new Error(`Date column "${dateColumn}" not found in data. Available columns: ${availableColumns.join(', ')}`);
        }
        
        if (matchingTargetColumns.length === 0) {
          throw new Error(`Target column "${targetColumn}" not found in data. Available columns: ${availableColumns.join(', ')}`);
        }
        
        // Use the actual column name from the data (preserving case)
        const actualDateColumn = matchingDateColumns[0];
        const actualTargetColumn = matchingTargetColumns[0];
        
        console.log(`Using actual column names: date="${actualDateColumn}", target="${actualTargetColumn}"`);
        
        // Create a copy of the data specifically for the ML API
        // This ensures we don't modify the original data used by other components
        const mlData = preparedData.map(item => {
          const newItem = { ...item };
          
          // Ensure date is in string format for the ML API
          if (newItem[actualDateColumn] instanceof Date) {
            newItem[actualDateColumn] = newItem[actualDateColumn].toISOString();
          }
          
          return newItem;
        });
        
        // Request multiple waterfall plots for different examples
        const analysisResults = await analyzeData(mlData, actualDateColumn, actualTargetColumn, true);
        setResults(analysisResults);
      } else {
        throw new Error('No data available for analysis');
      }
    } catch (err) {
      console.error('ML Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during analysis');
      setAnalysisInitiated(false); // Reset if there's an error so we can try again
    } finally {
      setLoading(false);
    }
  }, [preparedData, dateColumn, targetColumn, loading]);
  
  // Check if the API is available when the component mounts
  useEffect(() => {
    const checkApi = async () => {
      setCheckingApi(true);
      try {
        const isAvailable = await checkApiHealth();
        setApiAvailable(isAvailable);
      } catch (err) {
        console.error('Error in API check:', err);
        setApiAvailable(false);
      } finally {
        setCheckingApi(false);
      }
    };
    
    checkApi();
  }, []);
  
  // Automatically run analysis when API is available
  useEffect(() => {
    if (apiAvailable === true && !results && !loading && !analysisInitiated && preparedData.length > 0) {
      handleAnalyze();
    }
  }, [apiAvailable, results, loading, analysisInitiated, handleAnalyze, preparedData.length]);
  
  // Add a comment to clarify data source
  useEffect(() => {
    const dataSource = dataContext?.allData?.length ? 'DataContext' : 'props';
    console.log(`ML Analysis is using data from ${dataSource} (${preparedData.length} records)`);
  }, [dataContext, preparedData.length]);
  
  const renderMetrics = () => {
    if (!results) return null;
    
    const { metrics } = results;
    
    return (
      <Card sx={{ bgcolor: '#1a1f2c', color: 'white', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Model Performance Metrics
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Training Set (80%)
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>RMSE:</strong> {metrics.train_rmse.toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  <strong>R²:</strong> {metrics.train_r2.toFixed(4)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Test Set (20%)
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>RMSE:</strong> {metrics.test_rmse.toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  <strong>R²:</strong> {metrics.test_r2.toFixed(4)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  const renderFeatureImportance = () => {
    if (!results) return null;
    
    const { feature_importance } = results;
    
    return (
      <Card sx={{ bgcolor: '#1a1f2c', color: 'white', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Feature Importance
          </Typography>
          <Box sx={{ mt: 2 }}>
            {feature_importance.map((item, index) => (
              <Box key={index} sx={{ mb: 1 }}>
                <Grid container alignItems="center">
                  <Grid item xs={4}>
                    <Typography variant="body2">{item.feature}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box
                      sx={{
                        width: `${item.importance * 100}%`,
                        height: 10,
                        bgcolor: '#1976d2',
                        borderRadius: 1,
                      }}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" align="right">
                      {(item.importance * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };
  
  const renderShapPlots = () => {
    if (!results) return null;
    
    const { shap_plots } = results;
    
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            SHAP Analysis
          </Typography>
        </Box>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            What are SHAP values?
          </Typography>
          <Typography variant="body2">
            SHAP (SHapley Additive exPlanations) values explain how much each feature contributes to the prediction
            for a specific instance, compared to the average prediction. They help understand which features are most
            important for the model's predictions and how they impact the outcome.
          </Typography>
        </Alert>
        
        <Grid container spacing={3}>
          {/* Bar Plot - Now first */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: '#1a1f2c', color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">
                  SHAP Feature Importance
                </Typography>
                <Tooltip title={shapDescriptions.bar}>
                  <IconButton size="small" sx={{ color: 'white' }}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Feature Importance:</strong> Shows the average impact of each feature on the model's predictions. Features are ordered by importance, with the most important at the top. The percentage indicates how much each feature contributes to the model's decisions.
              </Typography>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <img 
                  src={`data:image/png;base64,${shap_plots.bar_plot}`} 
                  alt="SHAP Bar Plot" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </Box>
            </Paper>
          </Grid>
          
          {/* Beeswarm Plot - Renamed to Summary Plot */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: '#1a1f2c', color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">
                  SHAP Summary Plot
                </Typography>
                <Tooltip title={shapDescriptions.beeswarm}>
                  <IconButton size="small" sx={{ color: 'white' }}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Summary Plot:</strong> Shows the impact of each feature on the model output. Features are ordered by importance, with the most important at the top. Points to the right indicate a positive impact (increasing the prediction), while points to the left indicate a negative impact (decreasing the prediction).
              </Typography>
              <Typography variant="subtitle2" gutterBottom>Colors:</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Chip label="High Feature Value" sx={{ bgcolor: '#ff0000', color: 'white' }} />
                <Chip label="Medium Feature Value" sx={{ bgcolor: '#ff7f7f', color: 'black' }} />
                <Chip label="Low Feature Value" sx={{ bgcolor: '#0000ff', color: 'white' }} />
              </Box>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <img 
                  src={`data:image/png;base64,${shap_plots.beeswarm_plot}`} 
                  alt="SHAP Summary Plot" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </Box>
            </Paper>
          </Grid>
          
          {/* Force Plots - Multiple examples */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, bgcolor: '#1a1f2c', color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">
                  SHAP Force Plots (Sample Predictions)
                </Typography>
                <Tooltip title={shapDescriptions.force}>
                  <IconButton size="small" sx={{ color: 'white' }}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Force Plot:</strong> Shows how each feature pushes the prediction higher or lower from the base value (average prediction). The width of each arrow indicates the magnitude of the effect.
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>Colors:</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Chip label="Increases Prediction" sx={{ bgcolor: '#ff0000', color: 'white' }} />
                <Chip label="Decreases Prediction" sx={{ bgcolor: '#0000ff', color: 'white' }} />
              </Box>
              
              <Grid container spacing={3} direction="column">
                {/* Low Sales Example */}
                <Grid item xs={12}>
                  <Box sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, p: 2 }}>
                    <Typography variant="subtitle2" align="center" gutterBottom>
                      Low Sales Example
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: '180px' }}>
                      <img 
                        src={`data:image/png;base64,${shap_plots.waterfall_plot_low}`} 
                        alt="SHAP Force Plot - Low Sales" 
                        style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: 'none' }}
                      />
                    </Box>
                  </Box>
                </Grid>
                
                {/* Medium Sales Example */}
                <Grid item xs={12}>
                  <Box sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, p: 2 }}>
                    <Typography variant="subtitle2" align="center" gutterBottom>
                      Medium Sales Example
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: '180px' }}>
                      <img 
                        src={`data:image/png;base64,${shap_plots.waterfall_plot_medium}`} 
                        alt="SHAP Force Plot - Medium Sales" 
                        style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: 'none' }}
                      />
                    </Box>
                  </Box>
                </Grid>
                
                {/* High Sales Example */}
                <Grid item xs={12}>
                  <Box sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, p: 2 }}>
                    <Typography variant="subtitle2" align="center" gutterBottom>
                      High Sales Example
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: '180px' }}>
                      <img 
                        src={`data:image/png;base64,${shap_plots.waterfall_plot_high}`} 
                        alt="SHAP Force Plot - High Sales" 
                        style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: 'none' }}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  const renderApiStatus = () => {
    if (checkingApi) {
      return (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 2 }} />
            <Typography>Checking ML API availability... Analysis will run automatically when ready.</Typography>
          </Box>
        </Alert>
      );
    }
    
    if (apiAvailable === false) {
      return (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            ML API Server Not Available
          </Typography>
          <Typography variant="body2" paragraph>
            The ML API server is not running. Machine learning analysis is not available at this time.
          </Typography>
          <Typography variant="body2">
            You can still use all other features of the application. The ML analysis requires a separate server component.
          </Typography>
        </Alert>
      );
    }
    
    if (apiAvailable === true && !results && !loading && !analysisInitiated) {
      return (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography>ML API is available. Analysis will start automatically.</Typography>
          </Box>
        </Alert>
      );
    }
    
    return null;
  };
  
  // If we don't have enough data, show a message
  if (preparedData.length < 10) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Machine Learning Analysis
        </Typography>
        
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2c', color: 'white' }}>
          <Typography variant="h6" gutterBottom>
            Not Enough Data
          </Typography>
          <Typography variant="body2" paragraph>
            Machine learning analysis requires at least 10 data points. Please upload a larger dataset.
          </Typography>
        </Paper>
      </Box>
    );
  }
  
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Machine Learning Analysis
      </Typography>
      
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2c', color: 'white' }}>
        <Typography variant="h6" gutterBottom>
          XGBoost Regression with SHAP Analysis
        </Typography>
        <Typography variant="body2" paragraph>
          This analysis uses XGBoost, a powerful gradient boosting algorithm, to predict {targetColumn} based on time features extracted from {dateColumn}. The model is trained on 80% of the data and tested on the remaining 20%.
        </Typography>
        <Typography variant="body2" paragraph>
          SHAP (SHapley Additive exPlanations) values are used to explain the model's predictions and understand feature importance.
        </Typography>
        
        {renderApiStatus()}
        
        {!results && apiAvailable === true && loading && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography>Running ML analysis...</Typography>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ML Analysis Error
            </Typography>
            <Typography variant="body2" paragraph>
              {error}
            </Typography>
            {error.includes("column") && (
              <Typography variant="body2" paragraph>
                This error typically occurs when the column names in your data don't match what the ML API expects. 
                Make sure your CSV file has properly named date and value columns.
              </Typography>
            )}
            {error.includes("Date column") && (
              <Box sx={{ mt: 1, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Suggestion:</strong> Your date column should be named "date" (case-sensitive). 
                  You can rename it in your CSV file before uploading.
                </Typography>
                <Typography variant="body2">
                  Common date column names that should work: "date", "Date", "timestamp", "time"
                </Typography>
              </Box>
            )}
            {error.includes("Target column") && (
              <Box sx={{ mt: 1, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Suggestion:</strong> Your target column (the numeric value you want to analyze) 
                  should be named "sales" or another recognizable name.
                </Typography>
                <Typography variant="body2">
                  Common target column names that should work: "sales", "Sales", "value", "amount", "target"
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 1 }}>
              <Button 
                size="small" 
                variant="outlined" 
                onClick={handleAnalyze}
                disabled={loading}
                startIcon={loading && <CircularProgress size={16} color="inherit" />}
              >
                Try Again
              </Button>
            </Box>
          </Alert>
        )}
      </Paper>
      
      {results && (
        <>
          {renderMetrics()}
          {renderFeatureImportance()}
          {renderShapPlots()}
        </>
      )}
      
      {apiAvailable === false && (
        <Paper sx={{ p: 2, bgcolor: '#1a1f2c', color: 'white' }}>
          <Typography variant="h6" gutterBottom>
            ML Analysis Not Available
          </Typography>
          <Typography variant="body2" paragraph>
            The machine learning analysis requires a separate API server to be running. This server handles the computational tasks of training models and generating visualizations.
          </Typography>
          <Typography variant="body2" paragraph>
            You can still use all other features of the application, including data visualization and pattern analysis.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>For Developers:</strong> If you're running this application locally, you need to start the ML API server separately. Check the project documentation for instructions.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default MLAnalysis; 