import React from 'react';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/styles';
import Box from '@material-ui/core/Box';
import OptionSelect from './components/OptionSelect';
import OptionCheck from './components/OptionCheck';

const useStyles = makeStyles(theme => ({
  Model: {
    padding: '10px 5px 10px 10px',
    flexGrow: 1,
    height: '100%',
    maxWidth: '800px',
  },
  form: {
    '& > *': {
      marginRight: '10px',
    }
  },
}));

const Model = ({ run }) => {

  const classes = useStyles();

  return (
    <div className={classes.Model}>
      <Box component="form" mt={1} mb={2} display="flex" alignItems="center" className={classes.form} noValidate autoComplete="off">
        <OptionSelect option={run.analysis} />
        <OptionSelect option={run.numRuns} />
        <OptionSelect option={run.numRepetitions} />
        <OptionCheck option={run.branchLength} />
        <OptionCheck option={run.sHlike} />
        <OptionCheck option={run.combinedOutput} />
        <OptionSelect option={run.startingTree} />
        <OptionSelect option={run.outGroup} />
      </Box>

    </div>
  );
};


Model.propTypes = {
  run: PropTypes.object.isRequired,
};

export default observer(Model);