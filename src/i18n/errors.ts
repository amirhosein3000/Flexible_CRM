import {message,type Values} from "./messages.ts";
import type {Locale} from "./config.ts";
const ids={
  "A provider and model must be configured first.": "errorAProviderAndModelMustBeConfiguredFirst",
  "Copilot could not reach the configured provider.": "errorCopilotCouldNotReachTheConfiguredProvider",
  "The provider returned an invalid response.": "errorTheProviderReturnedAnInvalidResponse",
  "The deterministic adapter is available only in a demo.": "errorTheDeterministicAdapterIsAvailableOnlyInADemo",
  "An approved provider and model must be configured by the operator.": "errorAnApprovedProviderAndModelMustBeConfiguredByTheOperator",
  "Copilot is off in this workspace.": "errorCopilotIsOffInThisWorkspace",
  "This workspace has reached its Copilot usage limit.": "errorThisWorkspaceHasReachedItsCopilotUsageLimit",
  "Try signing in again in 10 minutes.": "errorTrySigningInAgainIn10Minutes",
  "The email or password is incorrect.": "errorTheEmailOrPasswordIsIncorrect",
  "Add at least one option.": "errorAddAtLeastOneOption",
  "Add this as optional because the object already has records.": "errorAddThisAsOptionalBecauseTheObjectAlreadyHasRecords",
  "Place each active field in at most one section.": "errorPlaceEachActiveFieldInAtMostOneSection",
  "Choose a pipeline and stage together.": "errorChooseAPipelineAndStageTogether",
  "Choose an active filter field.": "errorChooseAnActiveFilterField",
  "Choose a sortable field.": "errorChooseASortableField",
  "Choose stages from this pipeline.": "errorChooseStagesFromThisPipeline",
  "Move all records and remove automation references before removing {stage}.": "errorMoveAllRecordsAndRemoveAutomationReferencesBeforeRemovingStage",
  "You don't have permission to do that.": "errorYouDontHavePermissionToDoThat",
  "This item could not be found.": "errorThisItemCouldNotBeFound",
  "This item changed. Refresh and try again.": "errorThisItemChangedRefreshAndTryAgain",
  "Choose a valid IANA time zone.": "errorChooseAValidIANATimeZone",
  "Choose a supported ISO currency code.": "errorChooseASupportedISOCurrencyCode",
  "Check the value for {field}.": "errorCheckTheValueForField",
  "{field} is required.": "errorFieldIsRequired",
  "{field} requires true or false.": "errorFieldRequiresTrueOrFalse",
  "A field was removed. Refresh and try again.": "errorAFieldWasRemovedRefreshAndTryAgain",
  "Choose a stage on this object.": "errorChooseAStageOnThisObject",
  "Enter text for each task or notification.": "errorEnterTextForEachTaskOrNotification",
  "Select a teammate for assignments and notifications.": "errorSelectATeammateForAssignmentsAndNotifications",
  "A scheduled run is limited to 100 records.": "errorAScheduledRunIsLimitedTo100Records",
  "Sign in to your existing account to accept the invitation.": "errorSignInToYourExistingAccountToAcceptTheInvitation",
  "These records do not match the relationship.": "errorTheseRecordsDoNotMatchTheRelationship",
  "A CSV field has invalid quoting.": "errorACSVFieldHasInvalidQuoting",
  "A CSV field has an unclosed quote.": "errorACSVFieldHasAnUnclosedQuote",
  "Use a consistent header and 1-5,000 data rows.": "errorUseAConsistentHeaderAnd15000DataRows",
  "CSV column names must be unique.": "errorCSVColumnNamesMustBeUnique",
  "The object changed. Preview the import again.": "errorTheObjectChangedPreviewTheImportAgain",
  "Filter this export to at most 5,000 records.": "errorFilterThisExportToAtMost5000Records",
  "The request could not be read.": "errorTheRequestCouldNotBeRead",
  "A matching item already exists or this link exceeds its allowed cardinality.": "errorAMatchingItemAlreadyExistsOrThisLinkExceedsItsAllowedCardinality",
  "The related item could not be found.": "errorTheRelatedItemCouldNotBeFound",
  "Cairn couldn’t complete this request. Try again.": "errorCairnCouldntCompleteThisRequestTryAgain",
  "This request must originate from Cairn.": "errorThisRequestMustOriginateFromCairn",
  "The request is too large.": "errorTheRequestIsTooLarge",
  "Sign in to continue.": "errorSignInToContinue",
  "Enter a name.": "errorEnterAName",
  "Invalid row.": "errorInvalidRow",
  "Enter a valid value.": "errorEnterAValidValue",
  "Enter a valid email address.": "errorEnterAValidEmailAddress",
  "Enter a valid date.": "errorEnterAValidDate",
  "Enter at least {minimum, number} characters.": "errorEnterAtLeastMinimumNumberCharacters",
  "Use at most {maximum, number} characters.": "errorUseAtMostMaximumNumberCharacters",
  "Check the entered value.": "errorCheckTheEnteredValue"
} as const;
export function errorText(locale:Locale,source:string,values?:Values) {
  const id=ids[source as keyof typeof ids]??ids[source.replace(/’/g,"'") as keyof typeof ids];
  return id?message(locale,id,values):locale==="fa-IR"?message(locale,"errorCheckTheEnteredValue"):source;
}
export function englishError(source:string,values?:Values) {
  return values?errorText("en",source,values):source;
}
