import React from "react";
import styled from "styled-components";
import { Transition, TransitionStatus } from "react-transition-group";
import { connect } from "react-redux";
import { createStructuredSelector, createSelector } from "reselect";
import { modalsStateSelector } from "~/renderer/reducers/modals";
import modals from "~/renderer/modals";

// TODO: SNOOOOOOOOWW
// import Snow, { isSnowTime } from '~/renderer/components/extra/Snow'

const BackDrop = styled.div.attrs<{ state: TransitionStatus }>(({ state }) => ({
  style: {
    opacity: state === "entered" ? 1 : 0,
  },
}))<{ state: TransitionStatus }>`
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.65);
  z-index: 100;
  opacity: 0;
  transition: opacity 200ms cubic-bezier(0.3, 1, 0.5, 0.8);
`;
const ModalsLayer = ({
  visibleModals,
}: {
  visibleModals: { name: string; MODAL_SHOW_ONCE?: boolean }[];
}) => {
  const filteredModals = visibleModals
    .filter(({ name, MODAL_SHOW_ONCE }) => !MODAL_SHOW_ONCE || !global.sessionStorage.getItem(name))
    .slice(0, 1);
  filteredModals.forEach(
    ({ name, MODAL_SHOW_ONCE }) =>
      MODAL_SHOW_ONCE && global.sessionStorage.setItem(name, "" + Date.now()),
  );
  return (
    <Transition
      in={filteredModals.length > 0}
      appear
      mountOnEnter
      unmountOnExit
      timeout={{
        appear: 100,
        enter: 100,
        exit: 200,
      }}
    >
      {state => (
        <BackDrop state={state}>
          {/* {// Will only render at the end of december
           isSnowTime() ? <Snow numFlakes={200} /> : null} */}
          {filteredModals.map(({ name, ...data }) => {
            const ModalComponent = modals[name];
            return <ModalComponent key={name} name={name} {...data} />;
          })}
        </BackDrop>
      )}
    </Transition>
  );
};
const visibleModalsSelector = createSelector(modalsStateSelector, state =>
  Object.keys(state)
    .filter((name: string) => !!modals[name] && state[name].isOpened)
    .map((name: string) => ({
      name,
      ...state[name].data,
    })),
);
const mapStateToProps = createStructuredSelector({
  visibleModals: visibleModalsSelector,
});

export default connect(mapStateToProps)(ModalsLayer);
