import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { notify } from 'react-notify-toast';
import ReactTable from 'react-table';
import FlankingStratConfig from './FlankingStratConfig';
import Genome from '../model/genomes/Genome';
import Feature from '../model/Feature';
import FlankingStrategy from '../model/FlankingStrategy';
import RegionSet from '../model/RegionSet';
import ChromosomeInterval from '../model/interval/ChromosomeInterval';
import { getSymbolRegions } from '../util';

import 'react-table/react-table.css';

const DEFAULT_LIST = `CYP4A22
chr10:96796528-96829254
CYP2A6
CYP3A4
chr1:47223509-47276522
CYP1A2
`;

function RegionSetConfig({ genome, set: setProp, onSetConfigured = () => undefined, onClose }) {
    const [set, setSet] = useState(getRegionSetFromProps(setProp));
    const [newRegionName, setNewRegionName] = useState("");
    const [newRegionLocus, setNewRegionLocus] = useState("");
    const [newRegionError, setNewRegionError] = useState(null);
    const [regionList, setRegionList] = useState(DEFAULT_LIST);
    const [loadingMsg, setLoadingMsg] = useState("");
    const [originalSet, setOriginalSet] = useState(null);

    //replacement for original class component UNSAFE_componentWillReceiveProps lifecycle method
    //considerations:
    //the old method and this hook are not triggered by the same events;
    //however, as implemented, I believe the results are functionally equivalent
    //additionally, if the setProp dependency is checked by reference rather than value,
    //it should be memoized by the parent before being passed as an argument to RegionSetConfig
    useEffect(() => {
        if (setProp !== set) {
            setSet(getRegionSetFromProps(setProp));
        }
    }, [setProp]);

    //included to explicitly show complete refactoring; however, in the original code, sections
    //of this function are commented out, resulting in a function that simply extracts the relevant
    //prop from the full props list and returns it. If the original behavior is no longer needed,
    //this method can be removed entirely and replaced with direct references to this set
    function getRegionSetFromProps(propsSet) {
        return propsSet;
    }

    const handleListChange = (event) => {
        setRegionList(event.target.value);
    };

    const resetList = (event) => {
        setRegionList('');
    };

    const handleAddList = async (event) => {
      event.preventDefault();
      const genomeName = genome.getName();
      setLoadingMsg("loading");
      const inputListRaw = regionList.trim().split("\n");
      const inputListRaw2 = inputListRaw.map((item) => item.trim());
      const inputList = inputListRaw2.filter((item) => item !== "");
      if (inputList.length === 0) {
          notify.show("Input content is empty or cannot find any location on genome", "error", 2000);
          setLoadingMsg("");
          return null;
      }
      const promise = inputList.map((symbol) => {
          try {
              const locus = ChromosomeInterval.parse(symbol);
              if (locus) {
                  return new Feature(symbol, locus, "+"); // coordinates default have + as strand
              }
          } catch (error) {}
          return getSymbolRegions(genomeName, symbol);
      });
      //TODO does this need error handling?
      const parsed = await Promise.all(promise);
      const parsed2 = parsed.map((item, index) => {
          if (Array.isArray(item)) {
              if (item.length === 0) {
                  return null;
              }
              // eslint-disable-next-line array-callback-return
              const hits = item.map((gene) => {
                  if (gene.name.toLowerCase() === inputList[index].toLowerCase()) {
                      return new Feature(
                          gene.name,
                          new ChromosomeInterval(gene.chrom, gene.txStart, gene.txEnd),
                          gene.strand
                      );
                  }
              });
              const hits2 = hits.filter((hit) => hit); // removes undefined
              if (hits2.length === 0) {
                  return null;
              }
              return hits2[0] || null;
          } else {
              return item;
          }
      });
      const nullList = parsed2.filter((item) => item === null);
      if (nullList.length > 0) {
          notify.show(`${nullList.length} item(s) cannot find location(s) on genome`, "error", 2000);
      } else {
          notify.show(`${parsed2.length} region(s) added`, "success", 2000);
      }
      setLoadingMsg("");
      const newSet = new RegionSet(
          "New set",
          parsed2.filter((item) => item !== null),
          this.props.genome,
          new FlankingStrategy()
      );
      setSet(newSet);
    };

    //use arrow function rather than direct value since this relies on previous state
    //due to state update batching, by the time an update occurs, a direct value may be "stale"
    //however, functions are provided with the current state at the time of update execution
    const changeSetName = (event) => {
        setSet(prevSet => prevSet.cloneAndSet("name", event.target.value));
    };

    const changeSetStrategy = (newStrat) => {
        setSet(prevSet => prevSet.cloneAndSet("flankingStrategy", newStrat));
    };

    const handleFlipChange = (event) => {
      // to avoid unnecessary deep clone, check if there is any feature on - strand
      const currentSet = originalSet ? originalSet : set;
      const setOnMinus = currentSet.features.filter((f) => f.getIsReverseStrand());
      if (setOnMinus.length === 0) {
          return;
      }
      if (event.target.checked) {
          // do not flip
          const backupSet = _.cloneDeep(set);
          const normalizedPlusFeatures = set.cloneAndAllPlusStrand();
          setOriginalSet(backupSet);
          setSet(normalizedPlusFeatures);
      } else {
          // do whatever designed
          const revertedSet = _.cloneDeep(originalSet);
          setSet(revertedSet);
          setOriginalSet(null);
      }
    };

    const addRegion = () => {
      let newSet = null;
      try {
          const locus = ChromosomeInterval.parse(newRegionLocus);
          if (!locus) {
              throw new RangeError("Could not parse locus");
          }
          newSet = set.cloneAndAddFeature(new Feature(newRegionName, locus));
      } catch (error) {
          setNewRegionError(error);
      }
      if (newSet) {
          setSet(newSet);
          setNewRegionName("");
          setNewRegionLocus("");
          setNewRegionError(null);
      }
    };

    const deleteRegion = (index) => {
        setSet(prevSet => prevSet.cloneAndDeleteFeature(index));
    };

    const renderRegions = () => {
      if (!set) {
          return [];
      }

      const features = set.features;
      const flankedFeatures = set.makeFlankedFeatures();

      let rows = [];
      for (let i = 0; i < features.length; i++) {
          const feature = features[i];
          const flankedLocus = flankedFeatures[i] ? flankedFeatures[i].getLocus().toString() : "(invalid)";

          rows.push(
              <tr key={i}>
                  <td>{feature.getName()}</td>
                  <td>{feature.getLocus().toString()}</td>
                  <td>{feature.getIsForwardStrand() ? "+" : "-"}</td>
                  <td>{flankedLocus}</td>
                  <td>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteRegion(i)}>
                          Delete
                      </button>
                  </td>
              </tr>
          );
      }

      return rows;

    };

    const isSaveButtonDisabled = () => {
      return (
          set === setProp ||
          set.makeFlankedFeatures().some((feature) => feature === null)
      );

    };

    const cancelPressed = () => {
        setSet(getRegionSetFromProps(setProp));
    };

    //the following constants are passed to ReactTable within the return statement
    //it may be a good idea to memoize these for performance
    const defaultFilterMethod = (filter, row) =>
        String(row[filter.id]).toLowerCase().includes(filter.value.toLowerCase());
    const features = set ? set.features : [];
    const flankedFeatures = set ? set.makeFlankedFeatures() : [];
    const columns = [
        {
            Header: "Name",
            accessor: (feature) => feature.getName(),
            id: "name",
        },
        {
            Header: "Locus",
            accessor: (feature) => feature.getLocus().toString(),
            id: "locus",
        },
        {
            Header: "Strand",
            accessor: (feature) => (feature.getIsForwardStrand() ? "+" : "-"),
            id: "strand",
        },
        {
            Header: "Coordinates to view",
            Cell: (reactTableRow) =>
                flankedFeatures[reactTableRow.index]
                    ? flankedFeatures[reactTableRow.index].getLocus().toString()
                    : "(invalid)",
            id: "adjustedLocus",
        },
        {
            Header: "Delete",
            Cell: (reactTableRow) => (
                <button className="btn btn-sm btn-danger" onClick={() => deleteRegion(reactTableRow.index)}>
                    Delete
                </button>
            ),
            id: "deleteLocus",
        },
    ];

    return (
      <div>
          <h3>{setProp ? `Editing set: "${setProp.name}"` : "Create a new set"}</h3>

          {!set && (
              <div>
                  <h4>Enter a list of regions</h4>
                  <p>
                      Enter a list of gene names or coordinates to make a gene set one item per line. Gene names
                      and coordinates can be mixed for input. Coordinate string must be in the form of
                      "chr1:345-678" fields can be joined by space/tab/comma/colon/hyphen.
                  </p>
                  <form onSubmit={handleAddList}>
                      <label>
                          <textarea
                              value={regionList}
                              onChange={handleListChange}
                              rows={10}
                              cols={40}
                          />
                      </label>
                      <div>
                          <input className="btn btn-sm btn-primary" type="submit" value="Add" />{" "}
                          <input
                              className="btn btn-sm btn-secondary"
                              type="reset"
                              value="Clear"
                              onClick={this.resetList}
                          />{" "}
                          <span style={{ fontStyle: "italic", color: "red" }}>{loadingMsg}</span>
                      </div>
                  </form>
              </div>
          )}

          {set && set.features.length > 0 && (
              <React.Fragment>
                  <label style={{ marginTop: "1ch" }}>
                      1. Rename this set:{" "}
                      <input
                          type="text"
                          placeholder="Set name"
                          value={set ? set.name : "New set"}
                          onChange={changeSetName}
                      />
                  </label>

                  <div>
                      <h6>2. Add one region or delete region(s) from the table below</h6>
                      <label>
                          New region name:{" "}
                          <input
                              type="text"
                              value={newRegionName}
                              onChange={(event) =>  setNewRegionName(event.target.value)}
                          />
                      </label>{" "}
                      <label>
                          New region locus:{" "}
                          <input
                              type="text"
                              value={newRegionLocus}
                              onChange={(event) => setNewRegionLocus(event.target.value)}
                          />
                      </label>{" "}
                      <button className="btn btn-sm btn-success" onClick={addRegion}>
                          Add new region
                      </button>
                      {newRegionError ? newRegionError.message : null}
                  </div>

                  <ReactTable
                      filterable
                      defaultPageSize={10}
                      defaultFilterMethod={defaultFilterMethod}
                      minRows={Math.min(features.length, 10)}
                      data={features}
                      columns={columns}
                      className="-striped -highlight"
                  />
                  <FlankingStratConfig
                      strategy={set.flankingStrategy}
                      onNewStrategy={changeSetStrategy}
                  />

                  <div>
                      <label htmlFor="flip">
                          No flip for regions on <span className="font-weight-bold">-</span> strand:
                          <input type="checkbox" name="flip" id="flip" onChange={handleFlipChange} />
                      </label>
                  </div>
                  <div>
                      <button
                          className="btn btn-sm btn-success"
                          onClick={() => onSetConfigured(set)}
                          disabled={isSaveButtonDisabled()}
                      >
                          Add set & Save changes
                      </button>{" "}
                      <button className="btn btn-sm btn-secondary" onClick={cancelPressed}>
                          Cancel
                      </button>
                  </div>
              </React.Fragment>
          )}
      </div>

    );
}

RegionSetConfig.propTypes = {
    genome: PropTypes.instanceOf(Genome).isRequired,
    set: PropTypes.instanceOf(RegionSet),
    onSetConfigured: PropTypes.func,
    onClose: PropTypes.func,
};

export default RegionSetConfig;

